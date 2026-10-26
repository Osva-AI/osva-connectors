import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GOOGLE_ADS_API_HOST,
  GOOGLE_ADS_API_VERSION,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { GoogleAdsTokenProvider } from "./google-ads-auth.js";
import type { GoogleAdsClient } from "./google-ads-client.js";

export interface GoogleAdsHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly googleStatus?: string;
  readonly googleMessage?: string;
  readonly requestId?: string;
  readonly retryAfterMs?: number;
}

interface GoogleErrorBody {
  readonly error?: {
    readonly code?: number;
    readonly message?: string;
    readonly status?: string;
    readonly details?: readonly unknown[];
  };
}

export interface CreateGoogleAdsRestClientOptions {
  readonly tokenProvider: GoogleAdsTokenProvider;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly apiVersion?: string;
  readonly loginCustomerId?: string;
  readonly developerToken?: string;
  readonly fetchImpl?: typeof fetch;
}

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Ads request URL is invalid.",
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
      "Google Ads request URL is not allowlisted.",
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
        "Google Ads response exceeds the connector size limit.",
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
        "Google Ads response exceeds the connector size limit.",
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

function extractRequestId(
  details: readonly unknown[] | undefined,
): string | undefined {
  if (details === undefined) {
    return undefined;
  }
  for (const detail of details) {
    if (
      detail !== null &&
      typeof detail === "object" &&
      "@type" in detail &&
      typeof (detail as { "@type"?: string })["@type"] === "string" &&
      (detail as { "@type": string })["@type"].includes("RequestInfo")
    ) {
      const requestId = (detail as { requestId?: string }).requestId;
      if (typeof requestId === "string" && requestId.length > 0) {
        return requestId.slice(0, 128);
      }
    }
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
    (error as GoogleAdsHttpError).kind === "http"
  ) {
    const status = (error as GoogleAdsHttpError).status;
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

export function createGoogleAdsRestClient(
  options: CreateGoogleAdsRestClientOptions,
): GoogleAdsClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = options.apiHost ?? GOOGLE_ADS_API_HOST;
  const apiVersion = options.apiVersion ?? GOOGLE_ADS_API_VERSION;
  const requestTimeoutMs = options.requestTimeoutMs;
  const loginCustomerId = options.loginCustomerId;
  const developerToken = options.developerToken;

  async function requestJsonAttempt<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Google Ads request timed out."));
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

      const headers: Record<string, string> = {
        Authorization: authorization,
        Accept: "application/json",
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      };
      if (loginCustomerId !== undefined) {
        headers["login-customer-id"] = loginCustomerId;
      }
      if (developerToken !== undefined) {
        headers["developer-token"] = developerToken;
      }

      const response = await fetchImpl(url, {
        method: init.method,
        headers,
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
        const httpError: GoogleAdsHttpError = {
          kind: "http",
          status: response.status,
          googleStatus: googleBody?.error?.status,
          googleMessage: googleBody?.error?.message,
          requestId: extractRequestId(googleBody?.error?.details),
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
          "Google Ads returned invalid JSON.",
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
        throw new Error("Google Ads request timed out.");
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
          (error as GoogleAdsHttpError).kind === "http"
        ) {
          const httpError = error as GoogleAdsHttpError;
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
    listAccessibleCustomers(params) {
      const url = `${apiHost}/${apiVersion}/customers:listAccessibleCustomers`;
      return requestJson(url, { method: "GET", signal: params.signal });
    },

    search(params) {
      const url = `${apiHost}/${apiVersion}/customers/${params.customerId}/googleAds:search`;
      const body: Record<string, unknown> = {
        query: params.query,
      };
      if (params.pageSize !== undefined) {
        body.pageSize = params.pageSize;
      }
      if (params.pageToken !== undefined) {
        body.pageToken = params.pageToken;
      }
      return requestJson(url, {
        method: "POST",
        body,
        signal: params.signal,
      });
    },
  };
}
