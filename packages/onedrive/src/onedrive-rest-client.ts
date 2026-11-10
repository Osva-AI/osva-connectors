import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GRAPH_API_HOST,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { OneDriveTokenProvider } from "./onedrive-auth.js";
import {
  assertAllowedGraphContentDownloadUrl,
  GRAPH_CONTENT_MAX_REDIRECTS,
  parseGraphContentRedirectLocation,
} from "./graph-download-url.js";
import {
  assertAllowedGraphRequestUrl,
  assertSafeUploadFilename,
  validateGraphNextLink,
} from "./onedrive-ids.js";
import type {
  OneDriveClient,
  OneDriveGetDriveParams,
  OneDriveGetItemParams,
  OneDriveListChildrenParams,
  OneDriveReadContentParams,
  OneDriveSearchParams,
  OneDriveUploadSmallParams,
} from "./onedrive-client.js";

export interface OneDriveHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly graphCode?: string;
  readonly graphMessage?: string;
  readonly retryAfterMs?: number;
}

interface GraphErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

export interface CreateOneDriveRestClientOptions {
  readonly tokenProvider: OneDriveTokenProvider;
  readonly requestTimeoutMs: number;
  readonly graphApiHost?: string;
  readonly smallUploadMaxBytes?: number;
  readonly fetchImpl?: typeof fetch;
}

function driveItemPrefix(
  graphApiHost: string,
  driveId: string | undefined,
): string {
  if (driveId !== undefined) {
    return `${graphApiHost}/drives/${encodeURIComponent(driveId)}`;
  }
  return `${graphApiHost}/me/drive`;
}

async function readBoundedResponseBytes(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "OneDrive response exceeds the connector size limit.",
      );
    }
  }

  if (response.body === null) {
    return new Uint8Array(0);
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
        "OneDrive response exceeds the connector size limit.",
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
  return merged;
}

function parseGraphErrorBody(text: string): GraphErrorBody | undefined {
  try {
    return JSON.parse(text) as GraphErrorBody;
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
    (error as OneDriveHttpError).kind === "http"
  ) {
    const status = (error as OneDriveHttpError).status;
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

function throwHttpError(response: Response, bodyText: string): never {
  const graphBody = parseGraphErrorBody(bodyText);
  const retryAfterMs = parseRetryAfterMs(response);
  const httpError: OneDriveHttpError = {
    kind: "http",
    status: response.status,
    graphCode: graphBody?.error?.code,
    graphMessage: graphBody?.error?.message,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
  throw httpError;
}

export function createOneDriveRestClient(
  options: CreateOneDriveRestClientOptions,
): OneDriveClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const graphApiHost = options.graphApiHost ?? GRAPH_API_HOST;
  const requestTimeoutMs = options.requestTimeoutMs;
  const smallUploadMaxBytes = options.smallUploadMaxBytes ?? 262_144;

  async function requestAttempt(
    url: string,
    init: {
      readonly method: "GET" | "PUT";
      readonly signal?: AbortSignal;
      readonly accept: string;
      readonly maxResponseBytes: number;
      readonly body?: Uint8Array;
      readonly includeAuthorization?: boolean;
      readonly followContentRedirect?: boolean;
    },
    attemptTimeoutMs: number,
  ): Promise<{
    response: Response;
    bodyBytes: Uint8Array;
    redirectLocation?: string;
  }> {
    if (init.includeAuthorization === false) {
      assertAllowedGraphContentDownloadUrl(url);
    } else {
      assertAllowedGraphRequestUrl(url, graphApiHost);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("OneDrive request timed out."));
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
      const headers: Record<string, string> = {
        Accept: init.accept,
      };
      if (init.includeAuthorization !== false) {
        const authorization = await options.tokenProvider.getAuthorizationHeader({
          signal: init.signal,
          deadlineMs: attemptTimeoutMs,
        });
        headers.Authorization = authorization;
      }
      if (init.method === "PUT" && init.body !== undefined) {
        headers["Content-Type"] = "application/octet-stream";
      }

      const response = await fetchImpl(url, {
        method: init.method,
        headers,
        ...(init.body !== undefined ? { body: Buffer.from(init.body) } : {}),
        signal: controller.signal,
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        if (init.followContentRedirect === true) {
          const location = response.headers.get("Location");
          return {
            response,
            bodyBytes: new Uint8Array(0),
            redirectLocation: parseGraphContentRedirectLocation(location),
          };
        }
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "OneDrive redirect responses are not followed by this connector.",
        );
      }

      const bodyBytes = await readBoundedResponseBytes(
        response,
        init.maxResponseBytes,
        controller.signal,
      );

      if (!response.ok) {
        const bodyText = new TextDecoder("utf-8", { fatal: false }).decode(
          bodyBytes,
        );
        throwHttpError(response, bodyText);
      }

      return { response, bodyBytes };
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestWithRetry(
    url: string,
    init: {
      readonly method: "GET" | "PUT";
      readonly signal?: AbortSignal;
      readonly accept: string;
      readonly maxResponseBytes: number;
      readonly body?: Uint8Array;
      readonly includeAuthorization?: boolean;
      readonly followContentRedirect?: boolean;
    },
  ): Promise<{
    response: Response;
    bodyBytes: Uint8Array;
    redirectLocation?: string;
  }> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("OneDrive request timed out.");
      }

      try {
        return await requestAttempt(url, init, remainingMs);
      } catch (error) {
        if (error instanceof ConnectorSdkError) {
          throw error;
        }

        const canRetry =
          init.method === "GET" &&
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
          (error as OneDriveHttpError).kind === "http"
        ) {
          const httpError = error as OneDriveHttpError;
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

  async function requestJson<T>(
    url: string,
    init: {
      readonly signal?: AbortSignal;
      readonly maxResponseBytes?: number;
      readonly method?: "GET" | "PUT";
      readonly body?: Uint8Array;
    },
  ): Promise<T> {
    const { bodyBytes } = await requestWithRetry(url, {
      method: init.method ?? "GET",
      signal: init.signal,
      accept: "application/json",
      maxResponseBytes: init.maxResponseBytes ?? MAX_HTTP_RESPONSE_BYTES,
      ...(init.body !== undefined ? { body: init.body } : {}),
    });

    const text = new TextDecoder("utf-8", { fatal: false }).decode(bodyBytes);
    if (text.length === 0) {
      return {} as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "OneDrive returned invalid JSON.",
      );
    }
  }

  function listChildrenUrl(params: OneDriveListChildrenParams): string {
    if (params.nextLink !== undefined) {
      return validateGraphNextLink(params.nextLink, graphApiHost);
    }
    const prefix = driveItemPrefix(graphApiHost, params.driveId);
    if (params.itemId === undefined) {
      return `${prefix}/root/children?$top=${params.pageSize}`;
    }
    const itemId = encodeURIComponent(params.itemId);
    return `${prefix}/items/${itemId}/children?$top=${params.pageSize}`;
  }

  function searchUrl(params: OneDriveSearchParams): string {
    if (params.nextLink !== undefined) {
      return validateGraphNextLink(params.nextLink, graphApiHost);
    }
    const prefix = driveItemPrefix(graphApiHost, params.driveId);
    const odataQ = params.query.replace(/'/g, "''");
    return `${prefix}/root/search(q='${odataQ}')?$top=${params.pageSize}`;
  }

  return {
    getDrive(params: OneDriveGetDriveParams) {
      if (params.driveId !== undefined) {
        const url = `${graphApiHost}/drives/${encodeURIComponent(params.driveId)}`;
        return requestJson(url, { signal: params.signal });
      }
      const url = `${graphApiHost}/me/drive`;
      return requestJson(url, { signal: params.signal });
    },

    listChildren(params: OneDriveListChildrenParams) {
      const url = listChildrenUrl(params);
      return requestJson(url, { signal: params.signal });
    },

    getItem(params: OneDriveGetItemParams) {
      const prefix = driveItemPrefix(graphApiHost, params.driveId);
      const url = `${prefix}/items/${encodeURIComponent(params.itemId)}`;
      return requestJson(url, { signal: params.signal });
    },

    async readItemContent(params: OneDriveReadContentParams) {
      const prefix = driveItemPrefix(graphApiHost, params.driveId);
      let url = `${prefix}/items/${encodeURIComponent(params.itemId)}/content`;
      let redirects = 0;
      let includeAuthorization = true;
      let followContentRedirect = true;

      for (;;) {
        const { bodyBytes, redirectLocation, response } = await requestWithRetry(
          url,
          {
            method: "GET",
            signal: params.signal,
            accept: "*/*",
            maxResponseBytes: params.maxBytes,
            includeAuthorization,
            followContentRedirect,
          },
        );
        if (redirectLocation === undefined) {
          if (!response.ok) {
            const bodyText = new TextDecoder("utf-8", { fatal: false }).decode(
              bodyBytes,
            );
            throwHttpError(response, bodyText);
          }
          return bodyBytes;
        }
        redirects += 1;
        if (redirects > GRAPH_CONTENT_MAX_REDIRECTS) {
          throw new ConnectorSdkError(
            "PROVIDER_ERROR",
            "OneDrive content redirect chain is too long.",
          );
        }
        url = redirectLocation;
        includeAuthorization = false;
        followContentRedirect = false;
      }
    },

    searchItems(params: OneDriveSearchParams) {
      const url = searchUrl(params);
      return requestJson(url, { signal: params.signal });
    },

    uploadSmallFile(params: OneDriveUploadSmallParams) {
      if (params.content.byteLength > smallUploadMaxBytes) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Upload content exceeds the connector small-upload size limit.",
        );
      }
      const safeName = assertSafeUploadFilename(params.filename);
      const prefix = driveItemPrefix(graphApiHost, params.driveId);
      const parentId = encodeURIComponent(params.parentItemId);
      const url = `${prefix}/items/${parentId}:/${encodeURIComponent(safeName)}:/content`;
      return requestJson(url, {
        method: "PUT",
        signal: params.signal,
        body: params.content,
        maxResponseBytes: MAX_HTTP_RESPONSE_BYTES,
      });
    },
  };
}
