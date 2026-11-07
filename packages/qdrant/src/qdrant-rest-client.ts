import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { QdrantClient } from "./qdrant-client.js";

export interface QdrantHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly qdrantMessage?: string;
  readonly retryAfterMs?: number;
}

interface QdrantErrorBody {
  readonly status?: { error?: string };
  readonly message?: string;
}

export interface CreateQdrantRestClientOptions {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

function encodeCollectionSegment(name: string): string {
  return encodeURIComponent(name);
}

function buildHeaders(apiKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (apiKey !== undefined && apiKey.length > 0) {
    headers["api-key"] = apiKey;
  }
  return headers;
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
        "Qdrant response exceeds the connector size limit.",
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
        "Qdrant response exceeds the connector size limit.",
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

function parseQdrantErrorBody(text: string): QdrantErrorBody | undefined {
  try {
    return JSON.parse(text) as QdrantErrorBody;
  } catch {
    return undefined;
  }
}

function parseErrorMessage(
  body: QdrantErrorBody | undefined,
): string | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (typeof body.message === "string") {
    return body.message;
  }
  const statusError = body.status?.error;
  if (typeof statusError === "string") {
    return statusError;
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
    (error as QdrantHttpError).kind === "http"
  ) {
    const status = (error as QdrantHttpError).status;
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

function assertUrlOnBase(url: string, baseUrl: string): void {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  if (url !== normalizedBase && !url.startsWith(`${normalizedBase}/`)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Qdrant request URL is not allowed.",
    );
  }
}

export function createQdrantRestClient(
  options: CreateQdrantRestClientOptions,
): QdrantClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const apiKey = options.apiKey?.trim();
  const requestTimeoutMs = options.requestTimeoutMs;

  async function requestJsonAttempt<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body: unknown | undefined,
    signal: AbortSignal | undefined,
    attemptTimeoutMs: number,
    allowRetries: boolean,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    assertUrlOnBase(url, baseUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Qdrant request timed out."));
    }, attemptTimeoutMs);

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

    let attempt = 0;
    try {
      for (;;) {
        try {
          const response = await fetchImpl(url, {
            method,
            headers: buildHeaders(apiKey),
            body:
              body !== undefined
                ? JSON.stringify(body)
                : method === "GET"
                  ? undefined
                  : JSON.stringify({}),
            signal: controller.signal,
          });

          const text = await readBoundedResponseText(
            response,
            MAX_HTTP_RESPONSE_BYTES,
            controller.signal,
          );

          if (!response.ok) {
            const parsed = parseQdrantErrorBody(text);
            const httpError: QdrantHttpError = {
              kind: "http",
              status: response.status,
              ...(parseErrorMessage(parsed) !== undefined
                ? { qdrantMessage: parseErrorMessage(parsed) }
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
              "Qdrant returned invalid JSON.",
            );
          }
        } catch (error) {
          const canRetry =
            allowRetries &&
            attempt < READ_ONLY_MAX_RETRIES &&
            (isRetryableHttpError(error) || isRetryableNetworkError(error));
          if (!canRetry) {
            throw error;
          }
          attempt += 1;
          await sleepMs(READ_ONLY_RETRY_DELAY_MS, controller.signal);
        }
      }
    } finally {
      clearTimeout(timeout);
      if (signal !== undefined) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async function requestJson<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body: unknown | undefined,
    signal: AbortSignal | undefined,
    allowRetries: boolean,
  ): Promise<T> {
    return requestJsonAttempt<T>(
      method,
      path,
      body,
      signal,
      requestTimeoutMs,
      allowRetries,
    );
  }

  return {
    listCollections(signal) {
      return requestJson("GET", "/collections", undefined, signal, true);
    },

    getCollection(collectionName, signal) {
      const segment = encodeCollectionSegment(collectionName);
      return requestJson(
        "GET",
        `/collections/${segment}`,
        undefined,
        signal,
        true,
      );
    },

    getPoints(params) {
      const segment = encodeCollectionSegment(params.collectionName);
      const body: Record<string, unknown> = {
        ids: params.ids,
      };
      if (params.withPayload !== undefined) {
        body.with_payload = params.withPayload;
      }
      if (params.withVector !== undefined) {
        body.with_vector = params.withVector;
      }
      return requestJson(
        "POST",
        `/collections/${segment}/points`,
        body,
        params.signal,
        true,
      );
    },

    scrollPoints(params) {
      const segment = encodeCollectionSegment(params.collectionName);
      const body: Record<string, unknown> = {};
      if (params.limit !== undefined) {
        body.limit = params.limit;
      }
      if (params.offset !== undefined) {
        body.offset = params.offset;
      }
      if (params.filter !== undefined) {
        body.filter = params.filter;
      }
      if (params.withPayload !== undefined) {
        body.with_payload = params.withPayload;
      }
      if (params.withVector !== undefined) {
        body.with_vector = params.withVector;
      }
      return requestJson(
        "POST",
        `/collections/${segment}/points/scroll`,
        body,
        params.signal,
        true,
      );
    },

    queryPoints(params) {
      const segment = encodeCollectionSegment(params.collectionName);
      const body: Record<string, unknown> = {
        query: params.vector,
      };
      if (params.limit !== undefined) {
        body.limit = params.limit;
      }
      if (params.filter !== undefined) {
        body.filter = params.filter;
      }
      if (params.withPayload !== undefined) {
        body.with_payload = params.withPayload;
      }
      if (params.withVector !== undefined) {
        body.with_vector = params.withVector;
      }
      if (params.scoreThreshold !== undefined) {
        body.score_threshold = params.scoreThreshold;
      }
      return requestJson(
        "POST",
        `/collections/${segment}/points/query`,
        body,
        params.signal,
        true,
      );
    },

    countPoints(params) {
      const segment = encodeCollectionSegment(params.collectionName);
      const body: Record<string, unknown> = {};
      if (params.filter !== undefined) {
        body.filter = params.filter;
      }
      if (params.exact !== undefined) {
        body.exact = params.exact;
      }
      return requestJson(
        "POST",
        `/collections/${segment}/points/count`,
        body,
        params.signal,
        true,
      );
    },

    upsertPoints(params) {
      const segment = encodeCollectionSegment(params.collectionName);
      return requestJson(
        "PUT",
        `/collections/${segment}/points?wait=true`,
        { points: params.points },
        params.signal,
        false,
      );
    },
  };
}
