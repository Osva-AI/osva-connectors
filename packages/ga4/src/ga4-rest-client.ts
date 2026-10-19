import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  ANALYTICS_ADMIN_API_HOST,
  ANALYTICS_DATA_API_HOST,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { Ga4TokenProvider } from "./ga4-auth.js";
import type { Ga4Client } from "./ga4-client.js";
import { adminPropertyResourceName } from "./property-id.js";

export interface Ga4HttpError {
  readonly kind: "http";
  readonly status: number;
  readonly googleStatus?: string;
  readonly googleMessage?: string;
  readonly retryAfterMs?: number;
}

interface GoogleErrorBody {
  readonly error?: {
    readonly code?: number;
    readonly message?: string;
    readonly status?: string;
  };
}

export interface CreateGa4RestClientOptions {
  readonly tokenProvider: Ga4TokenProvider;
  readonly requestTimeoutMs: number;
  readonly dataApiHost?: string;
  readonly adminApiHost?: string;
  readonly fetchImpl?: typeof fetch;
  /** Optional bearer token substring for error redaction in tests. */
  readonly accessTokenForRedaction?: string;
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
        "Google Analytics response exceeds the connector size limit.",
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
        "Google Analytics response exceeds the connector size limit.",
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

function parseGoogleErrorBody(text: string): GoogleErrorBody | undefined {
  try {
    return JSON.parse(text) as GoogleErrorBody;
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
    (error as Ga4HttpError).kind === "http"
  ) {
    const status = (error as Ga4HttpError).status;
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

export function createGa4RestClient(
  options: CreateGa4RestClientOptions,
): Ga4Client {
  const fetchImpl = options.fetchImpl ?? fetch;
  const dataApiHost = options.dataApiHost ?? ANALYTICS_DATA_API_HOST;
  const adminApiHost = options.adminApiHost ?? ANALYTICS_ADMIN_API_HOST;
  const requestTimeoutMs = options.requestTimeoutMs;

  async function requestJsonAttempt<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
    attemptTimeoutMs: number,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Google Analytics request timed out."));
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
      const authorization = await options.tokenProvider.getAuthorizationHeader({
        signal: init.signal,
        deadlineMs: attemptTimeoutMs,
      });

      const response = await fetchImpl(url, {
        method: init.method,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          ...(init.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const googleBody = parseGoogleErrorBody(text);
        const retryAfterMs = parseRetryAfterMs(response);
        const httpError: Ga4HttpError = {
          kind: "http",
          status: response.status,
          googleStatus: googleBody?.error?.status,
          googleMessage: googleBody?.error?.message,
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
          "Google Analytics returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestJson<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<T> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Google Analytics request timed out.");
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
          (error as Ga4HttpError).kind === "http"
        ) {
          const httpError = error as Ga4HttpError;
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
    listAccountSummaries(params) {
      const search = new URLSearchParams();
      search.set("pageSize", String(params.pageSize));
      if (params.pageToken !== undefined) {
        search.set("pageToken", params.pageToken);
      }
      const url = `${adminApiHost}/v1beta/accountSummaries?${search.toString()}`;
      return requestJson(url, { method: "GET", signal: params.signal });
    },

    getProperty(params) {
      const resource = adminPropertyResourceName(params.propertyId);
      const url = `${adminApiHost}/v1beta/${resource}`;
      return requestJson(url, { method: "GET", signal: params.signal });
    },

    getMetadata(params) {
      const resource = adminPropertyResourceName(params.propertyId);
      const url = `${dataApiHost}/v1beta/${resource}/metadata`;
      return requestJson(url, { method: "GET", signal: params.signal });
    },

    runReport(params) {
      const resource = adminPropertyResourceName(params.propertyId);
      const url = `${dataApiHost}/v1beta/${resource}:runReport`;
      const body: Record<string, unknown> = {
        dateRanges: params.dateRanges,
        metrics: params.metrics,
        limit: params.limit,
        offset: params.offset,
      };
      if (params.dimensions !== undefined && params.dimensions.length > 0) {
        body.dimensions = params.dimensions;
      }
      if (params.dimensionFilter !== undefined) {
        body.dimensionFilter = params.dimensionFilter;
      }
      if (params.metricFilter !== undefined) {
        body.metricFilter = params.metricFilter;
      }
      if (params.orderBys !== undefined && params.orderBys.length > 0) {
        body.orderBys = params.orderBys;
      }
      return requestJson(url, {
        method: "POST",
        body,
        signal: params.signal,
      });
    },

    runRealtimeReport(params) {
      const resource = adminPropertyResourceName(params.propertyId);
      const url = `${dataApiHost}/v1beta/${resource}:runRealtimeReport`;
      const body: Record<string, unknown> = {
        limit: params.limit,
      };
      if (params.dimensions !== undefined && params.dimensions.length > 0) {
        body.dimensions = params.dimensions;
      }
      if (params.metrics !== undefined && params.metrics.length > 0) {
        body.metrics = params.metrics;
      }
      return requestJson(url, {
        method: "POST",
        body,
        signal: params.signal,
      });
    },
  };
}
