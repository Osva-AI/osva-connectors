import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { parseCrawlId } from "./crawl-id.js";
import {
  FIRECRAWL_API_HOST,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { FirecrawlClient } from "./firecrawl-client.js";
import { assertCrawlPaginationUrl } from "./pagination.js";

export interface FirecrawlHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly firecrawlError?: string;
  readonly retryAfterMs?: number;
}

interface FirecrawlErrorBody {
  readonly error?: string;
  readonly message?: string;
}

export interface CreateFirecrawlRestClientOptions {
  readonly apiKey: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "api.firecrawl.dev";

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl request URL is invalid.",
    );
  }

  const normalizedHost = apiHost.replace(/\/$/, "");
  const onApi =
    url === normalizedHost ||
    url.startsWith(`${normalizedHost}/`) ||
    url.startsWith(`${normalizedHost}?`);

  if (apiHost === FIRECRAWL_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Firecrawl request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Firecrawl request URL is not allowed.",
      );
    }
    return;
  }

  if (!onApi) {
    const isLocalTest =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (!(isLocalTest && apiHost.startsWith("http://"))) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Firecrawl request URL is not allowed.",
      );
    }
  }

  const allowedPaths = ["/scrape", "/search", "/map", "/crawl"];
  const pathAllowed =
    allowedPaths.some(
      (prefix) =>
        parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
    ) ||
    (apiHost !== FIRECRAWL_API_HOST &&
      (parsed.pathname.startsWith("/scrape") ||
        parsed.pathname.startsWith("/search") ||
        parsed.pathname.startsWith("/map") ||
        parsed.pathname.startsWith("/crawl")));

  if (!pathAllowed) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl request path is not allowed.",
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
        "Firecrawl response exceeds the connector size limit.",
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
        "Firecrawl response exceeds the connector size limit.",
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

function parseFirecrawlErrorBody(text: string): FirecrawlErrorBody | undefined {
  try {
    return JSON.parse(text) as FirecrawlErrorBody;
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
    (error as FirecrawlHttpError).kind === "http"
  ) {
    const status = (error as FirecrawlHttpError).status;
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

export function createFirecrawlRestClient(
  options: CreateFirecrawlRestClientOptions,
): FirecrawlClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? FIRECRAWL_API_HOST).replace(/\/$/, "");
  const requestTimeoutMs = options.requestTimeoutMs;
  const apiKey = options.apiKey.trim();

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
      controller.abort(new Error("Firecrawl request timed out."));
    }, attemptTimeoutMs);

    const onAbort = (): void => {
      controller.abort(init.signal?.reason);
    };
    init.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      };
      if (init.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetchImpl(url, {
        method: init.method,
        headers,
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const parsedBody = parseFirecrawlErrorBody(text);
        const message =
          parsedBody?.error ??
          parsedBody?.message ??
          response.statusText ??
          "Firecrawl request failed.";
        const httpError: FirecrawlHttpError = {
          kind: "http",
          status: response.status,
          firecrawlError: message,
          ...(response.status === 429
            ? { retryAfterMs: parseRetryAfterMs(response) }
            : {}),
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
          "Firecrawl returned invalid JSON.",
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
    let lastError: unknown;
    const attempts = READ_ONLY_MAX_RETRIES + 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await requestJsonAttempt<T>(url, init, requestTimeoutMs);
      } catch (error) {
        lastError = error;
        if (attempt >= attempts - 1) {
          break;
        }
        if (!isRetryableHttpError(error) && !isRetryableNetworkError(error)) {
          break;
        }
        const retryAfterMs =
          isRetryableHttpError(error) &&
          (error as FirecrawlHttpError).retryAfterMs !== undefined
            ? (error as FirecrawlHttpError).retryAfterMs
            : READ_ONLY_RETRY_DELAY_MS;
        await sleepMs(retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS, init.signal);
      }
    }
    throw lastError;
  }

  function apiUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${apiHost}${normalizedPath}`;
    assertAllowedApiUrl(url, apiHost);
    return url;
  }

  return {
    async scrape(params) {
      const url = apiUrl("/scrape");
      return requestJsonAttempt(
        url,
        {
          method: "POST",
          body: {
            url: params.url,
            formats: ["markdown"],
          },
          ...(params.signal !== undefined ? { signal: params.signal } : {}),
        },
        requestTimeoutMs,
      );
    },

    async search(params) {
      const url = apiUrl("/search");
      return requestJsonAttempt(
        url,
        {
          method: "POST",
          body: {
            query: params.query,
            limit: params.limit,
            scrapeOptions: {
              formats: ["markdown"],
            },
          },
          ...(params.signal !== undefined ? { signal: params.signal } : {}),
        },
        requestTimeoutMs,
      );
    },

    async map(params) {
      const body: Record<string, unknown> = {
        url: params.url,
        limit: params.limit,
      };
      if (params.search !== undefined) {
        body.search = params.search;
      }
      const url = apiUrl("/map");
      return requestJsonAttempt(
        url,
        {
          method: "POST",
          body,
          ...(params.signal !== undefined ? { signal: params.signal } : {}),
        },
        requestTimeoutMs,
      );
    },

    async startCrawl(params) {
      const url = apiUrl("/crawl");
      return requestJsonAttempt(
        url,
        {
          method: "POST",
          body: {
            url: params.url,
            limit: params.limit,
            maxDiscoveryDepth: params.maxDiscoveryDepth,
            scrapeOptions: {
              formats: ["markdown"],
            },
          },
          ...(params.signal !== undefined ? { signal: params.signal } : {}),
        },
        requestTimeoutMs,
      );
    },

    async getCrawlStatus(params) {
      const crawlId = parseCrawlId(params.crawlId);
      let url: string;
      if (params.next !== undefined) {
        url = assertCrawlPaginationUrl(params.next, apiHost);
      } else {
        const statusUrl = new URL(apiUrl(`/crawl/${crawlId}`));
        if (params.skip !== undefined && params.skip > 0) {
          statusUrl.searchParams.set("skip", String(params.skip));
        }
        url = statusUrl.toString();
        assertAllowedApiUrl(url, apiHost);
      }
      return requestJson(url, {
        method: "GET",
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },
  };
}
