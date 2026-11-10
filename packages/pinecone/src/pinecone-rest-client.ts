import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  PINECONE_API_VERSION,
  PINECONE_CONTROL_PLANE_HOST,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import {
  assertDenseIndexForVectorOps,
  assertServerlessIndexForList,
  assertVectorLengthMatchesIndex,
  extractIndexHost,
} from "./index-capabilities.js";
import { assertPineconeDataHost } from "./pinecone-host.js";
import type { PineconeClient } from "./pinecone-client.js";

export interface PineconeHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly pineconeMessage?: string;
}

interface PineconeErrorBody {
  readonly message?: string;
  readonly error?: string;
}

interface ResolvedIndex {
  readonly dataOrigin: string;
  readonly describe: Record<string, unknown>;
}

export interface CreatePineconeRestClientOptions {
  readonly apiKey: string;
  readonly requestTimeoutMs: number;
  readonly controlPlaneHost?: string;
  readonly fetchImpl?: typeof fetch;
  readonly allowLoopbackDataHosts?: boolean;
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Api-Key": apiKey,
    "X-Pinecone-Api-Version": PINECONE_API_VERSION,
  };
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
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
        "Pinecone response exceeds the connector size limit.",
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

function parseErrorMessage(
  body: PineconeErrorBody | undefined,
): string | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (typeof body.message === "string") {
    return body.message;
  }
  if (typeof body.error === "string") {
    return body.error;
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
    (error as PineconeHttpError).kind === "http"
  ) {
    const status = (error as PineconeHttpError).status;
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

function assertUrlAllowed(url: string, allowedOrigin: string): void {
  const normalizedAllowed = allowedOrigin.replace(/\/$/, "");
  if (url !== normalizedAllowed && !url.startsWith(`${normalizedAllowed}/`)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Pinecone request URL is not allowed.",
    );
  }
}

export function createPineconeRestClient(
  options: CreatePineconeRestClientOptions,
): PineconeClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const requestTimeoutMs = options.requestTimeoutMs;
  const controlPlaneHost = (
    options.controlPlaneHost ?? PINECONE_CONTROL_PLANE_HOST
  ).replace(/\/$/, "");
  const allowLoopback = options.allowLoopbackDataHosts === true;
  const indexCache = new Map<string, ResolvedIndex>();

  async function requestJsonAttempt<T>(
    url: string,
    allowedOrigin: string,
    method: "GET" | "POST",
    body: unknown | undefined,
    signal: AbortSignal | undefined,
    allowRetries: boolean,
  ): Promise<T> {
    assertUrlAllowed(url, allowedOrigin);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Pinecone request timed out."));
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
                  : undefined,
            signal: controller.signal,
          });

          const text = await readBoundedResponseText(
            response,
            MAX_HTTP_RESPONSE_BYTES,
            controller.signal,
          );

          if (!response.ok) {
            let parsedBody: PineconeErrorBody | undefined;
            try {
              parsedBody = JSON.parse(text) as PineconeErrorBody;
            } catch {
              parsedBody = undefined;
            }
            const httpError: PineconeHttpError = {
              kind: "http",
              status: response.status,
              ...(parseErrorMessage(parsedBody) !== undefined
                ? { pineconeMessage: parseErrorMessage(parsedBody) }
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
              "Pinecone returned invalid JSON.",
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

  async function resolveIndex(
    indexName: string,
    signal: AbortSignal | undefined,
    requireDense: boolean,
  ): Promise<ResolvedIndex> {
    const cached = indexCache.get(indexName);
    if (cached !== undefined) {
      if (requireDense) {
        assertDenseIndexForVectorOps(cached.describe);
      }
      return cached;
    }

    const url = `${controlPlaneHost}/indexes/${encodeURIComponent(indexName)}`;
    const describe = await requestJsonAttempt<Record<string, unknown>>(
      url,
      controlPlaneHost,
      "GET",
      undefined,
      signal,
      true,
    );
    const host = extractIndexHost(describe);
    const dataOrigin = assertPineconeDataHost(host, {
      ...(allowLoopback ? { allowLoopbackForTests: true } : {}),
    });
    if (requireDense) {
      assertDenseIndexForVectorOps(describe);
    }
    const resolved = { dataOrigin, describe };
    indexCache.set(indexName, resolved);
    return resolved;
  }

  return {
    listIndexes(signal) {
      const url = `${controlPlaneHost}/indexes`;
      return requestJsonAttempt(
        url,
        controlPlaneHost,
        "GET",
        undefined,
        signal,
        true,
      );
    },

    async describeIndex(indexName, signal) {
      const resolved = await resolveIndex(indexName, signal, false);
      return resolved.describe;
    },

    async describeIndexStats(params) {
      const resolved = await resolveIndex(
        params.indexName,
        params.signal,
        false,
      );
      const url = `${resolved.dataOrigin}/describe_index_stats`;
      return requestJsonAttempt(
        url,
        resolved.dataOrigin,
        "POST",
        {},
        params.signal,
        true,
      );
    },

    async queryVectors(params) {
      const resolved = await resolveIndex(
        params.indexName,
        params.signal,
        true,
      );
      assertVectorLengthMatchesIndex(resolved.describe, params.vector.length);
      const body: Record<string, unknown> = {
        vector: params.vector,
        topK: params.topK ?? 10,
      };
      if (params.namespace !== undefined) {
        body.namespace = params.namespace;
      }
      if (params.filter !== undefined) {
        body.filter = params.filter;
      }
      if (params.includeMetadata !== undefined) {
        body.includeMetadata = params.includeMetadata;
      }
      if (params.includeValues !== undefined) {
        body.includeValues = params.includeValues;
      }
      const url = `${resolved.dataOrigin}/query`;
      return requestJsonAttempt(
        url,
        resolved.dataOrigin,
        "POST",
        body,
        params.signal,
        true,
      );
    },

    async fetchVectors(params) {
      const resolved = await resolveIndex(
        params.indexName,
        params.signal,
        false,
      );
      const search = new URLSearchParams();
      for (const id of params.ids) {
        search.append("ids", id);
      }
      if (params.namespace !== undefined) {
        search.set("namespace", params.namespace);
      }
      const url = `${resolved.dataOrigin}/vectors/fetch?${search.toString()}`;
      return requestJsonAttempt(
        url,
        resolved.dataOrigin,
        "GET",
        undefined,
        params.signal,
        true,
      );
    },

    async listVectors(params) {
      const resolved = await resolveIndex(
        params.indexName,
        params.signal,
        false,
      );
      assertServerlessIndexForList(resolved.describe);
      const search = new URLSearchParams();
      if (params.namespace !== undefined) {
        search.set("namespace", params.namespace);
      }
      if (params.limit !== undefined) {
        search.set("limit", String(params.limit));
      }
      if (params.paginationToken !== undefined) {
        search.set("paginationToken", params.paginationToken);
      }
      const query = search.toString();
      const url = `${resolved.dataOrigin}/vectors/list${query.length > 0 ? `?${query}` : ""}`;
      return requestJsonAttempt(
        url,
        resolved.dataOrigin,
        "GET",
        undefined,
        params.signal,
        true,
      );
    },

    async upsertVectors(params) {
      const resolved = await resolveIndex(
        params.indexName,
        params.signal,
        true,
      );
      for (const vector of params.vectors) {
        assertVectorLengthMatchesIndex(resolved.describe, vector.values.length);
      }
      const body: Record<string, unknown> = {
        vectors: params.vectors,
      };
      if (params.namespace !== undefined) {
        body.namespace = params.namespace;
      }
      const url = `${resolved.dataOrigin}/vectors/upsert`;
      return requestJsonAttempt(
        url,
        resolved.dataOrigin,
        "POST",
        body,
        params.signal,
        false,
      );
    },
  };
}
