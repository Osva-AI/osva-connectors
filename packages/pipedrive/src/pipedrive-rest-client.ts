import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  MAX_HTTP_REQUEST_BODY_BYTES,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { PipedriveClient } from "./pipedrive-client.js";

export interface PipedriveHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly retryAfterMs?: number;
}

const PATH_PATTERNS = [
  { method: "GET", pattern: /^\/pipelines$/ },
  { method: "GET", pattern: /^\/stages$/ },
  { method: "GET", pattern: /^\/deals$/ },
  { method: "GET", pattern: /^\/deals\/\d+$/ },
  { method: "GET", pattern: /^\/deals\/search$/ },
  { method: "GET", pattern: /^\/persons$/ },
  { method: "GET", pattern: /^\/persons\/\d+$/ },
  { method: "GET", pattern: /^\/organizations$/ },
  { method: "GET", pattern: /^\/organizations\/\d+$/ },
  { method: "PATCH", pattern: /^\/deals\/\d+$/ },
];

function assertAllowedRelativePath(method: string, pathname: string): void {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (
    !PATH_PATTERNS.some(
      (entry) => entry.method === method && entry.pattern.test(normalized),
    )
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Pipedrive request path is not supported.",
    );
  }
}

function assertAllowedApiUrl(
  pinnedOrigin: string,
  apiBaseUrl: string,
  url: string,
): void {
  const parsed = new URL(url);
  if (parsed.origin !== pinnedOrigin) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Pipedrive request URL is not allowed.",
    );
  }
  const basePath = new URL(apiBaseUrl).pathname.replace(/\/$/, "");
  if (!parsed.pathname.startsWith(basePath)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Pipedrive request URL is not allowed.",
    );
  }
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal | undefined,
): Promise<string> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Pipedrive response exceeds the connector size limit.",
      );
    }
  }
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) break;
    if (value === undefined) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Pipedrive response exceeds the connector size limit.",
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

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function extractPipedriveDataRows(raw: unknown): unknown[] {
  if (typeof raw !== "object" || raw === null) return [];
  const data = (raw as { data?: unknown }).data;
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

export function extractPipedriveNextCursor(raw: unknown): string | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const additional = (raw as { additional_data?: unknown }).additional_data;
  if (typeof additional !== "object" || additional === null) return undefined;
  const pagination = (additional as { pagination?: unknown }).pagination;
  if (typeof pagination !== "object" || pagination === null) return undefined;
  const cursor = (pagination as { next_cursor?: unknown }).next_cursor;
  return typeof cursor === "string" && cursor.length > 0 ? cursor : undefined;
}

export function extractPipedriveEntity(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const data = (raw as { data?: unknown }).data;
  return data !== undefined ? data : raw;
}

export interface CreatePipedriveRestClientOptions {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  readonly apiToken: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

export function createPipedriveRestClient(
  options: CreatePipedriveRestClientOptions,
): PipedriveClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.apiBaseUrl.replace(/\/$/, "");
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, "");

  async function requestJson(
    method: string,
    relativePath: string,
    signal: AbortSignal | undefined,
    body?: Record<string, unknown>,
    query?: URLSearchParams,
  ): Promise<unknown> {
    const pathOnly = relativePath.split("?")[0] ?? relativePath;
    const relative = pathOnly.startsWith(basePath)
      ? pathOnly.slice(basePath.length) || "/"
      : pathOnly.startsWith("/")
        ? pathOnly
        : `/${pathOnly}`;
    assertAllowedRelativePath(method, relative);
    const suffix = query !== undefined ? `?${query.toString()}` : "";
    const url = `${baseUrl}${relative}${suffix}`;
    assertAllowedApiUrl(
      options.pinnedOrigin,
      baseUrl,
      url.split("?")[0] ?? url,
    );
    let bodyText: string | undefined;
    if (body !== undefined) {
      bodyText = JSON.stringify(body);
      if (Buffer.byteLength(bodyText, "utf8") > MAX_HTTP_REQUEST_BODY_BYTES) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Pipedrive update payload exceeds the size limit.",
        );
      }
    }
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        options.requestTimeoutMs,
      );
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await fetchImpl(url, {
          method,
          redirect: "manual",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-api-token": options.apiToken,
          },
          ...(bodyText !== undefined ? { body: bodyText } : {}),
          signal: controller.signal,
        });
        if (response.status >= 300 && response.status < 400) {
          throw new ConnectorSdkError(
            "PROVIDER_ERROR",
            "Pipedrive redirects are not followed.",
          );
        }
        const text = await readBoundedResponseText(
          response,
          MAX_HTTP_RESPONSE_BYTES,
          signal,
        );
        if (response.ok) {
          if (text.length === 0) return null;
          try {
            return JSON.parse(text);
          } catch {
            throw new ConnectorSdkError(
              "PROVIDER_ERROR",
              "Pipedrive returned invalid JSON.",
            );
          }
        }
        const httpError: PipedriveHttpError = {
          kind: "http",
          status: response.status,
          ...(parseRetryAfterMs(response) !== undefined
            ? { retryAfterMs: parseRetryAfterMs(response) }
            : {}),
        };
        const retriable =
          method === "GET" &&
          attempt < READ_ONLY_MAX_RETRIES &&
          [429, 502, 503, 504].includes(response.status);
        if (retriable) {
          attempt += 1;
          await sleep(
            httpError.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS,
            signal,
          );
          continue;
        }
        throw httpError;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          if (signal?.aborted) throw error;
          throw new ConnectorSdkError(
            "TIMEOUT",
            "Pipedrive request timed out.",
          );
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  }

  function listQuery(
    params: { limit: number; cursor?: string },
    extra?: Record<string, string>,
  ): URLSearchParams {
    const query = new URLSearchParams();
    query.set("limit", String(params.limit));
    if (params.cursor !== undefined) query.set("cursor", params.cursor);
    if (extra !== undefined) {
      for (const [key, value] of Object.entries(extra)) {
        query.set(key, value);
      }
    }
    return query;
  }

  return {
    listPipelines: (params, signal) =>
      requestJson("GET", "/pipelines", signal, undefined, listQuery(params)),
    listStages: (params, signal) => {
      const extra =
        params.pipelineId !== undefined
          ? { pipeline_id: String(params.pipelineId) }
          : undefined;
      return requestJson(
        "GET",
        "/stages",
        signal,
        undefined,
        listQuery(params, extra),
      );
    },
    listDeals: async (params, signal) => {
      const raw = await requestJson(
        "GET",
        "/deals",
        signal,
        undefined,
        listQuery(params),
      );
      return {
        items: raw,
        ...(extractPipedriveNextCursor(raw) !== undefined
          ? { nextCursor: extractPipedriveNextCursor(raw) }
          : {}),
      };
    },
    getDeal: (dealId, signal) => requestJson("GET", `/deals/${dealId}`, signal),
    searchDeals: (term, params, signal) => {
      const query = listQuery(params);
      query.set("term", term);
      return requestJson("GET", "/deals/search", signal, undefined, query);
    },
    listPersons: async (params, signal) => {
      const raw = await requestJson(
        "GET",
        "/persons",
        signal,
        undefined,
        listQuery(params),
      );
      return {
        items: raw,
        ...(extractPipedriveNextCursor(raw) !== undefined
          ? { nextCursor: extractPipedriveNextCursor(raw) }
          : {}),
      };
    },
    getPerson: (personId, signal) =>
      requestJson("GET", `/persons/${personId}`, signal),
    listOrganizations: async (params, signal) => {
      const raw = await requestJson(
        "GET",
        "/organizations",
        signal,
        undefined,
        listQuery(params),
      );
      return {
        items: raw,
        ...(extractPipedriveNextCursor(raw) !== undefined
          ? { nextCursor: extractPipedriveNextCursor(raw) }
          : {}),
      };
    },
    getOrganization: (organizationId, signal) =>
      requestJson("GET", `/organizations/${organizationId}`, signal),
    setDealStage: (dealId, body, signal) =>
      requestJson("PATCH", `/deals/${dealId}`, signal, body),
  };
}
