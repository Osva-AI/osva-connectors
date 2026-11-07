import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { MixpanelAuthProvider } from "./mixpanel-auth.js";
import type { MixpanelClient } from "./mixpanel-client.js";
import {
  PRODUCTION_QUERY_HOSTS,
  resolveMixpanelQueryApiHost,
  type MixpanelRegion,
} from "./mixpanel-region.js";

export interface MixpanelHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly mixpanelMessage?: string;
  readonly retryAfterMs?: number;
}

interface MixpanelErrorBody {
  readonly error?: string;
  readonly message?: string;
}

export interface CreateMixpanelRestClientOptions {
  readonly authProvider: MixpanelAuthProvider;
  readonly projectId: number;
  readonly region: MixpanelRegion;
  readonly workspaceId?: number;
  readonly requestTimeoutMs: number;
  readonly queryApiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const ALLOWED_GET_PATHS = new Set([
  "/insights",
  "/segmentation",
  "/funnels",
  "/retention",
  "/events/top",
]);

const ALLOWED_POST_PATHS = new Set(["/cohorts/list"]);

function assertAllowedApiUrl(url: string, queryApiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Mixpanel request URL is invalid.",
    );
  }

  const normalizedHost = queryApiHost.replace(/\/$/, "");
  const onApi =
    url === normalizedHost ||
    url.startsWith(`${normalizedHost}/`) ||
    url.startsWith(`${normalizedHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Mixpanel request URL is not allowed.",
    );
  }

  if (PRODUCTION_QUERY_HOSTS.has(queryApiHost)) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Mixpanel request URL is not allowed.",
      );
    }
    const expectedHost = new URL(queryApiHost).hostname;
    if (parsed.hostname !== expectedHost) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Mixpanel request URL is not allowed.",
      );
    }
  } else if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Mixpanel request URL is not allowed.",
    );
  }

  const pathname = parsed.pathname.replace(/\/$/, "") || "/";
  if (!(ALLOWED_GET_PATHS.has(pathname) || ALLOWED_POST_PATHS.has(pathname))) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Mixpanel request path is not supported.",
    );
  }
}

function assertPathAllowed(method: "GET" | "POST", pathname: string): void {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (method === "GET" && !ALLOWED_GET_PATHS.has(normalized)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Mixpanel request path is not supported.",
    );
  }
  if (method === "POST" && !ALLOWED_POST_PATHS.has(normalized)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Mixpanel request path is not supported.",
    );
  }
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Mixpanel response exceeds the connector size limit.",
      );
    }
  }

  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value === undefined) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Mixpanel response exceeds the connector size limit.",
      );
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function parseMixpanelErrorBody(text: string): MixpanelErrorBody | undefined {
  try {
    return JSON.parse(text) as MixpanelErrorBody;
  } catch {
    return undefined;
  }
}

function parseErrorMessage(
  body: MixpanelErrorBody | undefined,
  fallbackText: string,
): string | undefined {
  if (body !== undefined) {
    if (typeof body.error === "string") {
      return body.error;
    }
    if (typeof body.message === "string") {
      return body.message;
    }
  }
  if (fallbackText.trim().length > 0) {
    return fallbackText.slice(0, 512);
  }
  return undefined;
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isRetryableHttpError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as MixpanelHttpError).kind === "http"
  ) {
    const status = (error as MixpanelHttpError).status;
    return status === 429 || status >= 500;
  }
  return false;
}

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 60_000);
  }
  return undefined;
}

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
): void {
  if (value === undefined) {
    return;
  }
  params.set(key, String(value));
}

export function createMixpanelRestClient(
  options: CreateMixpanelRestClientOptions,
): MixpanelClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const queryApiHost = (
    options.queryApiHost ?? resolveMixpanelQueryApiHost(options.region)
  ).replace(/\/$/, "");
  const authProvider = options.authProvider;
  const projectId = options.projectId;
  const workspaceId = options.workspaceId;
  const requestTimeoutMs = options.requestTimeoutMs;

  function baseQueryParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set("project_id", String(projectId));
    if (workspaceId !== undefined) {
      params.set("workspace_id", String(workspaceId));
    }
    return params;
  }

  async function requestJsonAttempt<T>(
    method: "GET" | "POST",
    path: string,
    query: URLSearchParams | undefined,
    body: unknown | undefined,
    signal: AbortSignal | undefined,
    attemptTimeoutMs: number,
    allowRetries: boolean,
  ): Promise<T> {
    const pathname = path.startsWith("/") ? path : `/${path}`;
    assertPathAllowed(method, pathname);

    const url = new URL(`${queryApiHost}${pathname}`);
    if (query !== undefined) {
      for (const [key, value] of query.entries()) {
        url.searchParams.set(key, value);
      }
    }
    assertAllowedApiUrl(url.toString(), queryApiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Mixpanel request timed out."));
    }, attemptTimeoutMs);

    const onAbort = (): void => {
      controller.abort(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: authProvider.getAuthorizationHeader(),
      };
      if (method === "POST") {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetchImpl(url.toString(), {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (response.ok) {
        if (text.length === 0) {
          return {} as T;
        }
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new ConnectorSdkError(
            "PROVIDER_ERROR",
            "Mixpanel returned an invalid JSON response.",
          );
        }
      }

      const errorBody = parseMixpanelErrorBody(text);
      const httpError: MixpanelHttpError = {
        kind: "http",
        status: response.status,
        mixpanelMessage: parseErrorMessage(errorBody, text),
        retryAfterMs: parseRetryAfterMs(response),
      };

      if (allowRetries && isRetryableHttpError(httpError)) {
        await sleepMs(
          httpError.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS,
          signal,
        );
        return requestJsonAttempt<T>(
          method,
          path,
          query,
          body,
          signal,
          attemptTimeoutMs,
          false,
        );
      }

      throw httpError;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestJson<T>(
    method: "GET" | "POST",
    path: string,
    query: URLSearchParams | undefined,
    body: unknown | undefined,
    signal?: AbortSignal,
  ): Promise<T> {
    return requestJsonAttempt<T>(
      method,
      path,
      query,
      body,
      signal,
      requestTimeoutMs,
      true,
    );
  }

  return {
    async getInsights({ bookmarkId, signal }) {
      const query = baseQueryParams();
      query.set("bookmark_id", bookmarkId);
      return requestJson("GET", "/insights", query, undefined, signal);
    },

    async runSegmentation(params) {
      const query = baseQueryParams();
      query.set("event", params.event);
      query.set("from_date", params.fromDate);
      query.set("to_date", params.toDate);
      appendQueryParam(query, "unit", params.unit);
      appendQueryParam(query, "where", params.where);
      appendQueryParam(query, "on", params.on);
      appendQueryParam(query, "limit", params.limit);
      return requestJson(
        "GET",
        "/segmentation",
        query,
        undefined,
        params.signal,
      );
    },

    async getFunnel(params) {
      const query = baseQueryParams();
      query.set("funnel_id", params.funnelId);
      query.set("from_date", params.fromDate);
      query.set("to_date", params.toDate);
      appendQueryParam(query, "unit", params.unit);
      appendQueryParam(query, "where", params.where);
      appendQueryParam(query, "on", params.on);
      return requestJson("GET", "/funnels", query, undefined, params.signal);
    },

    async runRetention(params) {
      const query = baseQueryParams();
      query.set("born_event", params.bornEvent);
      query.set("event", params.event);
      query.set("from_date", params.fromDate);
      query.set("to_date", params.toDate);
      appendQueryParam(query, "retention_type", params.retentionType);
      appendQueryParam(query, "unit", params.unit);
      appendQueryParam(query, "where", params.where);
      appendQueryParam(query, "on", params.on);
      appendQueryParam(query, "limit", params.limit);
      return requestJson("GET", "/retention", query, undefined, params.signal);
    },

    async listCohorts({ signal }) {
      const query = baseQueryParams();
      return requestJson("POST", "/cohorts/list", query, {}, signal);
    },

    async getTopEvents({ limit, type, signal }) {
      const query = baseQueryParams();
      appendQueryParam(query, "limit", limit);
      appendQueryParam(query, "type", type ?? "general");
      return requestJson("GET", "/events/top", query, undefined, signal);
    },
  };
}
