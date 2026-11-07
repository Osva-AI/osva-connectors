import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
  EXA_API_HOST,
} from "./constants.js";
import type {
  ExaAnswerParams,
  ExaClient,
  ExaContentsParams,
  ExaSearchParams,
} from "./exa-client.js";

export interface ExaHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly exaMessage?: string;
  readonly exaTag?: string;
  readonly retryAfterMs?: number;
}

interface ExaErrorBody {
  readonly error?: string;
  readonly tag?: string;
}

export interface CreateExaRestClientOptions {
  readonly apiKey: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "api.exa.ai";

const ALLOWED_POST_PATHS = new Set(["/search", "/contents", "/answer"]);

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa request URL is invalid.",
    );
  }

  const onApi =
    url === apiHost ||
    url.startsWith(`${apiHost}/`) ||
    url.startsWith(`${apiHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa request URL is not allowed.",
    );
  }

  if (apiHost === EXA_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Exa request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Exa request URL is not allowed.",
      );
    }
  } else if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa request URL is not allowed.",
    );
  }

  const pathname = parsed.pathname.replace(/\/$/, "") || "/";
  if (!ALLOWED_POST_PATHS.has(pathname)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa request path is not supported.",
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
        "Exa response exceeds the connector size limit.",
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
        "Exa response exceeds the connector size limit.",
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

function parseExaErrorBody(text: string): ExaErrorBody | undefined {
  try {
    return JSON.parse(text) as ExaErrorBody;
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
    (error as ExaHttpError).kind === "http"
  ) {
    const status = (error as ExaHttpError).status;
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

function buildContentsOptions(
  includeText?: boolean,
  includeHighlights?: boolean,
): Record<string, unknown> | undefined {
  const contents: Record<string, unknown> = {};
  if (includeText === true) {
    contents.text = true;
  }
  if (includeHighlights === true) {
    contents.highlights = true;
  }
  return Object.keys(contents).length > 0 ? contents : undefined;
}

export function createExaRestClient(
  options: CreateExaRestClientOptions,
): ExaClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? EXA_API_HOST).replace(/\/$/, "");
  const requestTimeoutMs = options.requestTimeoutMs;
  const apiKey = options.apiKey.trim();

  async function requestJsonAttempt<T>(
    url: string,
    init: {
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Exa request timed out."));
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
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body:
          init.body !== undefined
            ? JSON.stringify(init.body)
            : JSON.stringify({}),
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const parsed = parseExaErrorBody(text);
        const httpError: ExaHttpError = {
          kind: "http",
          status: response.status,
          ...(parsed?.error !== undefined ? { exaMessage: parsed.error } : {}),
          ...(parsed?.tag !== undefined ? { exaTag: parsed.tag } : {}),
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
          "Exa returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (init.signal !== undefined) {
        init.signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async function requestJsonWithReadRetries<T>(
    url: string,
    init: {
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await requestJsonAttempt<T>(url, init, requestTimeoutMs);
      } catch (error) {
        const canRetry =
          attempt < READ_ONLY_MAX_RETRIES &&
          (isRetryableHttpError(error) || isRetryableNetworkError(error));
        if (!canRetry) {
          throw error;
        }
        attempt += 1;
        const retryAfter =
          error !== null &&
          typeof error === "object" &&
          "kind" in error &&
          (error as ExaHttpError).kind === "http"
            ? (error as ExaHttpError).retryAfterMs
            : undefined;
        await sleepMs(retryAfter ?? READ_ONLY_RETRY_DELAY_MS, init.signal);
      }
    }
  }

  return {
    async search(params: ExaSearchParams): Promise<unknown> {
      const url = `${apiHost}/search`;
      assertAllowedApiUrl(url, apiHost);
      const body: Record<string, unknown> = {
        query: params.query,
      };
      if (params.numResults !== undefined) {
        body.numResults = params.numResults;
      }
      if (params.type !== undefined) {
        body.type = params.type;
      }
      if (
        params.includeDomains !== undefined &&
        params.includeDomains.length > 0
      ) {
        body.includeDomains = params.includeDomains;
      }
      if (
        params.excludeDomains !== undefined &&
        params.excludeDomains.length > 0
      ) {
        body.excludeDomains = params.excludeDomains;
      }
      if (params.category !== undefined) {
        body.category = params.category;
      }
      const contents = buildContentsOptions(
        params.includeText,
        params.includeHighlights,
      );
      if (contents !== undefined) {
        body.contents = contents;
      }
      return requestJsonWithReadRetries(url, {
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },

    async getContents(params: ExaContentsParams): Promise<unknown> {
      const url = `${apiHost}/contents`;
      assertAllowedApiUrl(url, apiHost);
      const body: Record<string, unknown> = {
        urls: params.urls,
      };
      if (params.includeText === true) {
        body.text = true;
      }
      if (params.includeHighlights === true) {
        body.highlights = true;
      }
      return requestJsonWithReadRetries(url, {
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },

    async answer(params: ExaAnswerParams): Promise<unknown> {
      const url = `${apiHost}/answer`;
      assertAllowedApiUrl(url, apiHost);
      const body: Record<string, unknown> = {
        query: params.query,
        stream: false,
      };
      if (params.model !== undefined) {
        body.model = params.model;
      }
      if (params.includeCitationText === true) {
        body.text = true;
      }
      return requestJsonAttempt(
        url,
        {
          body,
          ...(params.signal !== undefined ? { signal: params.signal } : {}),
        },
        requestTimeoutMs,
      );
    },
  };
}
