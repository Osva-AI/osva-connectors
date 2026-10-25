import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
  SEARCH_CONSOLE_API_HOST,
  WEBMASTERS_API_HOST,
} from "./constants.js";
import type { GscTokenProvider } from "./gsc-auth.js";
import type { GscClient } from "./gsc-client.js";
import { encodeSiteUrlForApiPath, encodeSitemapFeedPath } from "./site-url.js";

export interface GscHttpError {
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

export interface CreateGscRestClientOptions {
  readonly tokenProvider: GscTokenProvider;
  readonly urlInspectionTokenProvider?: GscTokenProvider;
  readonly requestTimeoutMs: number;
  readonly webmastersApiHost?: string;
  readonly searchConsoleApiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAMES = new Set([
  "www.googleapis.com",
  "searchconsole.googleapis.com",
]);

function assertAllowedApiUrl(
  url: string,
  webmastersApiHost: string,
  searchConsoleApiHost: string,
): void {
  const onWebmasters =
    url.startsWith(`${webmastersApiHost}/`) ||
    url === `${webmastersApiHost}/sites`;
  const onSearchConsole = url.startsWith(`${searchConsoleApiHost}/`);
  if (!onWebmasters && !onSearchConsole) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Search Console request URL is not allowed.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Search Console request URL is invalid.",
    );
  }

  if (
    webmastersApiHost === WEBMASTERS_API_HOST ||
    searchConsoleApiHost === SEARCH_CONSOLE_API_HOST
  ) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Search Console request URL is not allowed.",
      );
    }
    if (!PRODUCTION_HOSTNAMES.has(parsed.hostname)) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Search Console request URL is not allowed.",
      );
    }
    return;
  }

  if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Search Console request URL is not allowed.",
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
        "Google Search Console response exceeds the connector size limit.",
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
        "Google Search Console response exceeds the connector size limit.",
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
    (error as GscHttpError).kind === "http"
  ) {
    const status = (error as GscHttpError).status;
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

export function createGscRestClient(
  options: CreateGscRestClientOptions,
): GscClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const webmastersApiHost = options.webmastersApiHost ?? WEBMASTERS_API_HOST;
  const searchConsoleApiHost =
    options.searchConsoleApiHost ?? SEARCH_CONSOLE_API_HOST;
  const requestTimeoutMs = options.requestTimeoutMs;
  const inspectionTokenProvider =
    options.urlInspectionTokenProvider ?? options.tokenProvider;

  async function requestJsonAttempt<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
      readonly tokenProvider: GscTokenProvider;
    },
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedApiUrl(url, webmastersApiHost, searchConsoleApiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Google Search Console request timed out."));
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
      const authorization = await init.tokenProvider.getAuthorizationHeader({
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
        const httpError: GscHttpError = {
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
          "Google Search Console returned invalid JSON.",
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
      readonly tokenProvider: GscTokenProvider;
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
        throw new Error("Google Search Console request timed out.");
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
          (error as GscHttpError).kind === "http"
        ) {
          const httpError = error as GscHttpError;
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
    listSites(params) {
      const url = `${webmastersApiHost}/sites`;
      return requestJson(url, {
        method: "GET",
        signal: params.signal,
        tokenProvider: options.tokenProvider,
      });
    },

    getSite(params) {
      const encoded = encodeSiteUrlForApiPath(params.siteUrl);
      const url = `${webmastersApiHost}/sites/${encoded}`;
      return requestJson(url, {
        method: "GET",
        signal: params.signal,
        tokenProvider: options.tokenProvider,
      });
    },

    searchAnalyticsQuery(params) {
      const encoded = encodeSiteUrlForApiPath(params.siteUrl);
      const url = `${webmastersApiHost}/sites/${encoded}/searchAnalytics/query`;
      const body: Record<string, unknown> = {
        startDate: params.startDate,
        endDate: params.endDate,
        rowLimit: params.rowLimit,
        startRow: params.startRow,
      };
      if (params.dimensions !== undefined && params.dimensions.length > 0) {
        body.dimensions = params.dimensions;
      }
      if (params.type !== undefined) {
        body.type = params.type;
      }
      if (params.aggregationType !== undefined) {
        body.aggregationType = params.aggregationType;
      }
      if (params.dataState !== undefined) {
        body.dataState = params.dataState;
      }
      if (
        params.dimensionFilterGroups !== undefined &&
        params.dimensionFilterGroups.length > 0
      ) {
        body.dimensionFilterGroups = params.dimensionFilterGroups;
      }
      return requestJson(url, {
        method: "POST",
        body,
        signal: params.signal,
        tokenProvider: options.tokenProvider,
      });
    },

    listSitemaps(params) {
      const encoded = encodeSiteUrlForApiPath(params.siteUrl);
      const search = new URLSearchParams();
      if (params.sitemapIndex !== undefined) {
        search.set("sitemapIndex", params.sitemapIndex);
      }
      const query = search.toString();
      const url = `${webmastersApiHost}/sites/${encoded}/sitemaps${query.length > 0 ? `?${query}` : ""}`;
      return requestJson(url, {
        method: "GET",
        signal: params.signal,
        tokenProvider: options.tokenProvider,
      });
    },

    getSitemap(params) {
      const encodedSite = encodeSiteUrlForApiPath(params.siteUrl);
      const encodedFeed = encodeSitemapFeedPath(params.sitemapUrl);
      const url = `${webmastersApiHost}/sites/${encodedSite}/sitemaps/${encodedFeed}`;
      return requestJson(url, {
        method: "GET",
        signal: params.signal,
        tokenProvider: options.tokenProvider,
      });
    },

    inspectUrl(params) {
      const url = `${searchConsoleApiHost}/urlInspection/index:inspect`;
      const body: Record<string, unknown> = {
        inspectionUrl: params.inspectionUrl,
        siteUrl: params.siteUrl,
      };
      if (params.languageCode !== undefined) {
        body.languageCode = params.languageCode;
      }
      return requestJson(url, {
        method: "POST",
        body,
        signal: params.signal,
        tokenProvider: inspectionTokenProvider,
      });
    },
  };
}
