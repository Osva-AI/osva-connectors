import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_HTTP_RESPONSE_BYTES, TAVILY_API_HOST } from "./constants.js";
import type {
  TavilyClient,
  TavilyCrawlParams,
  TavilyExtractParams,
  TavilySearchParams,
} from "./tavily-client.js";

export interface TavilyHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly detail?: unknown;
  readonly retryAfterMs?: number;
}

interface TavilyErrorBody {
  readonly detail?: unknown;
}

export interface CreateTavilyRestClientOptions {
  readonly apiKey: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "api.tavily.com";

const ALLOWED_POST_PATHS = ["/search", "/extract", "/crawl"] as const;

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Tavily request URL is invalid.",
    );
  }

  const onApi =
    url === apiHost ||
    url.startsWith(`${apiHost}/`) ||
    url.startsWith(`${apiHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Tavily request URL is not allowed.",
    );
  }

  if (apiHost === TAVILY_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Tavily request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Tavily request URL is not allowed.",
      );
    }
  } else if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Tavily request URL is not allowed.",
    );
  }

  const pathname = parsed.pathname.replace(/\/$/, "") || "/";
  if (!(ALLOWED_POST_PATHS as readonly string[]).includes(pathname)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Tavily request path is not supported.",
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
        "Tavily response exceeds the connector size limit.",
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
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value !== undefined) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Tavily response exceeds the connector size limit.",
        );
      }
      chunks.push(value);
    }
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function parseTavilyErrorBody(text: string): TavilyErrorBody | undefined {
  try {
    return JSON.parse(text) as TavilyErrorBody;
  } catch {
    return undefined;
  }
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

export function createTavilyRestClient(
  options: CreateTavilyRestClientOptions,
): TavilyClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? TAVILY_API_HOST).replace(/\/$/, "");
  const requestTimeoutMs = options.requestTimeoutMs;
  const apiKey = options.apiKey.trim();

  async function postJson<T>(
    pathname: (typeof ALLOWED_POST_PATHS)[number],
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    const url = `${apiHost}${pathname}`;
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Tavily request timed out."));
    }, requestTimeoutMs);

    const onAbort = (): void => {
      controller.abort(signal?.reason);
    };
    if (signal !== undefined) {
      if (signal.aborted) {
        clearTimeout(timeout);
        throw new DOMException("Aborted", "AbortError");
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const parsed = parseTavilyErrorBody(text);
        const httpError: TavilyHttpError = {
          kind: "http",
          status: response.status,
          ...(parsed?.detail !== undefined ? { detail: parsed.detail } : {}),
          ...(parseRetryAfterMs(response) !== undefined
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
          "Tavily returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (signal !== undefined) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  return {
    async search(params: TavilySearchParams): Promise<unknown> {
      const body: Record<string, unknown> = {
        query: params.query,
        include_usage: true,
        ...(params.maxResults !== undefined
          ? { max_results: params.maxResults }
          : {}),
        ...(params.searchDepth !== undefined
          ? { search_depth: params.searchDepth }
          : {}),
        ...(params.topic !== undefined ? { topic: params.topic } : {}),
        ...(params.includeAnswer === true ? { include_answer: true } : {}),
      };
      return postJson("/search", body, params.signal);
    },

    async extract(params: TavilyExtractParams): Promise<unknown> {
      const body: Record<string, unknown> = {
        urls: [...params.urls],
        include_usage: true,
        ...(params.extractDepth !== undefined
          ? { extract_depth: params.extractDepth }
          : {}),
        ...(params.format !== undefined ? { format: params.format } : {}),
      };
      return postJson("/extract", body, params.signal);
    },

    async crawl(params: TavilyCrawlParams): Promise<unknown> {
      const body: Record<string, unknown> = {
        url: params.url,
        max_depth: params.maxDepth,
        limit: params.limit,
        max_breadth: params.maxBreadth,
        include_usage: true,
        ...(params.instructions !== undefined
          ? { instructions: params.instructions }
          : {}),
        ...(params.format !== undefined ? { format: params.format } : {}),
      };
      return postJson("/crawl", body, params.signal);
    },
  };
}
