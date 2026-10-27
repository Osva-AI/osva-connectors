import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { computeAppSecretProof } from "./appsecret-proof.js";
import {
  MAX_HTTP_RESPONSE_BYTES,
  META_GRAPH_API_HOST,
  META_GRAPH_API_VERSION,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { AllowedBreakdown } from "./insights-allowlist.js";
import { INSIGHTS_FIELD_ALLOWLIST } from "./insights-allowlist.js";
import {
  assertPagingLinksSafe,
  extractAfterCursor,
  validatePaginationCursor,
} from "./pagination.js";

export interface MetaGraphHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly metaCode?: number;
  readonly metaSubcode?: number;
  readonly metaType?: string;
  readonly metaMessage?: string;
  readonly fbtraceId?: string;
  readonly retryAfterMs?: number;
}

interface MetaErrorBody {
  readonly error?: {
    readonly message?: string;
    readonly type?: string;
    readonly code?: number;
    readonly error_subcode?: number;
    readonly fbtrace_id?: string;
  };
}

export interface MetaGraphListParams {
  readonly path: string;
  readonly fields: readonly string[];
  readonly limit: number;
  readonly after?: string;
  readonly filtering?: readonly Record<string, unknown>[];
  readonly signal?: AbortSignal;
}

export interface MetaGraphGetParams {
  readonly path: string;
  readonly fields: readonly string[];
  readonly signal?: AbortSignal;
}

export interface MetaGraphInsightsParams {
  readonly path: string;
  readonly level: "account" | "campaign" | "adset" | "ad";
  readonly timeRange: { readonly since: string; readonly until: string };
  readonly limit: number;
  readonly after?: string;
  readonly breakdowns?: readonly AllowedBreakdown[];
  readonly actionAttributionWindows?: readonly string[];
  readonly useUnifiedAttributionSetting?: boolean;
  readonly signal?: AbortSignal;
}

export interface MetaGraphClient {
  listEdge(params: MetaGraphListParams): Promise<unknown>;
  getNode(params: MetaGraphGetParams): Promise<unknown>;
  getInsights(params: MetaGraphInsightsParams): Promise<unknown>;
}

export interface CreateMetaGraphClientOptions {
  readonly accessToken: string;
  readonly appSecret?: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly apiVersion?: string;
  readonly fetchImpl?: typeof fetch;
}

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads request URL is invalid.",
    );
  }
  const allowedHost = new URL(apiHost).host;
  const isLocalTest =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (isLocalTest && apiHost.startsWith("http://")) {
    return;
  }
  if (parsed.protocol !== "https:" || parsed.host !== allowedHost) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads request URL is not allowlisted.",
    );
  }
}

function assertSafeGraphPath(path: string): void {
  if (path.length === 0 || path.startsWith("/") || path.includes("..")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads request path is invalid.",
    );
  }
  if (path.includes("://")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads request path must not be a URL.",
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
        "Meta Ads response exceeds the connector size limit.",
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
        "Meta Ads response exceeds the connector size limit.",
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

function parseMetaErrorBody(text: string): MetaErrorBody | undefined {
  try {
    return JSON.parse(text) as MetaErrorBody;
  } catch {
    return undefined;
  }
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

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 30_000);
  }
  return undefined;
}

function isRetryableHttpError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as MetaGraphHttpError).kind === "http"
  ) {
    const status = (error as MetaGraphHttpError).status;
    return status === 429 || status >= 500;
  }
  return false;
}

function isRetryableNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.message.includes("fetch") || error.message.includes("network")))
  );
}

export function createMetaGraphClient(
  options: CreateMetaGraphClientOptions,
): MetaGraphClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = options.apiHost ?? META_GRAPH_API_HOST;
  const apiVersion = options.apiVersion ?? META_GRAPH_API_VERSION;
  const requestTimeoutMs = options.requestTimeoutMs;
  const accessToken = options.accessToken.trim();
  const appSecretProof =
    options.appSecret !== undefined
      ? computeAppSecretProof(accessToken, options.appSecret)
      : undefined;

  function buildUrl(path: string, query: Record<string, string>): string {
    assertSafeGraphPath(path);
    const url = new URL(`${apiHost}/${apiVersion}/${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    if (appSecretProof !== undefined) {
      url.searchParams.set("appsecret_proof", appSecretProof);
    }
    assertAllowedApiUrl(url.toString(), apiHost);
    return url.toString();
  }

  async function requestJsonAttempt<T>(
    url: string,
    init: { readonly signal?: AbortSignal },
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Meta Ads request timed out."));
    }, attemptTimeoutMs);

    const onAbort = (): void => {
      controller.abort(init.signal?.reason);
    };
    if (init.signal !== undefined) {
      if (init.signal.aborted) {
        clearTimeout(timeout);
        throw new DOMException("Aborted", "AbortError");
      }
      init.signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const metaBody = parseMetaErrorBody(text);
        const retryAfterMs = parseRetryAfterMs(response);
        const httpError: MetaGraphHttpError = {
          kind: "http",
          status: response.status,
          metaCode: metaBody?.error?.code,
          metaSubcode: metaBody?.error?.error_subcode,
          metaType: metaBody?.error?.type,
          metaMessage: metaBody?.error?.message,
          fbtraceId: metaBody?.error?.fbtrace_id,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
        throw httpError;
      }

      if (text.length === 0) {
        return {} as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Meta Ads returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestJson<T>(
    url: string,
    init: { readonly signal?: AbortSignal },
  ): Promise<T> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Meta Ads request timed out.");
      }

      try {
        return await requestJsonAttempt<T>(url, init, remainingMs);
      } catch (error) {
        if (error instanceof ConnectorSdkError) {
          throw error;
        }

        const canRetry =
          attempt < READ_ONLY_MAX_RETRIES &&
          (isRetryableHttpError(error) || isRetryableNetworkError(error));
        if (!canRetry) {
          throw error;
        }

        attempt += 1;
        const remainingAfterError = deadlineMs - Date.now();
        if (remainingAfterError <= 0) {
          throw error;
        }

        let delayMs = READ_ONLY_RETRY_DELAY_MS;
        let retryAfterRequested: number | undefined;
        if (
          error !== null &&
          typeof error === "object" &&
          "kind" in error &&
          (error as MetaGraphHttpError).kind === "http"
        ) {
          const httpError = error as MetaGraphHttpError;
          retryAfterRequested = httpError.retryAfterMs;
          delayMs = httpError.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS;
        }
        if (
          retryAfterRequested !== undefined &&
          retryAfterRequested > remainingAfterError
        ) {
          throw error;
        }
        delayMs = Math.min(delayMs, remainingAfterError);
        await sleepMs(delayMs, init.signal);
      }
    }
  }

  return {
    getNode(params) {
      const url = buildUrl(params.path, {
        fields: params.fields.join(","),
      });
      return requestJson(url, { signal: params.signal });
    },

    listEdge(params) {
      const query: Record<string, string> = {
        fields: params.fields.join(","),
        limit: String(params.limit),
      };
      const after = validatePaginationCursor(params.after);
      if (after !== undefined) {
        query.after = after;
      }
      if (params.filtering !== undefined && params.filtering.length > 0) {
        query.filtering = JSON.stringify(params.filtering);
      }
      const url = buildUrl(params.path, query);
      return requestJson(url, { signal: params.signal });
    },

    getInsights(params) {
      const query: Record<string, string> = {
        fields: INSIGHTS_FIELD_ALLOWLIST.join(","),
        level: params.level,
        time_range: JSON.stringify(params.timeRange),
        limit: String(params.limit),
      };
      const after = validatePaginationCursor(params.after);
      if (after !== undefined) {
        query.after = after;
      }
      if (params.breakdowns !== undefined && params.breakdowns.length > 0) {
        query.breakdowns = params.breakdowns.join(",");
      }
      if (
        params.actionAttributionWindows !== undefined &&
        params.actionAttributionWindows.length > 0
      ) {
        query.action_attribution_windows = JSON.stringify(
          params.actionAttributionWindows,
        );
      }
      if (params.useUnifiedAttributionSetting === true) {
        query.use_unified_attribution_setting = "true";
      }
      const url = buildUrl(`${params.path}/insights`, query);
      return requestJson(url, { signal: params.signal });
    },
  };
}

export function parseGraphListResponse(
  raw: unknown,
  apiHost: string,
): {
  data: unknown[];
  nextCursor: string | undefined;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads returned an unexpected list payload.",
    );
  }
  const record = raw as { data?: unknown; paging?: unknown };
  assertPagingLinksSafe(record.paging, apiHost);
  const data = Array.isArray(record.data) ? record.data : [];
  const nextCursor = extractAfterCursor(record.paging);
  return { data, nextCursor };
}
