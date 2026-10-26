import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  CHANGE_FILE_FIELDS,
  DRIVE_API_HOST,
  FILE_LIST_FIELDS,
  FILE_METADATA_FIELDS,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { DriveTokenProvider } from "./drive-auth.js";
import { folderChildrenQuery } from "./drive-ids.js";
import type {
  DriveChangesListParams,
  DriveChangesStartParams,
  DriveClient,
  DriveExportFileParams,
  DriveGetFileParams,
  DriveListFilesParams,
  DriveListFolderChildrenParams,
  DriveListSharedDrivesParams,
  DriveReadFileMediaParams,
} from "./drive-client.js";

export interface DriveHttpError {
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

export interface CreateDriveRestClientOptions {
  readonly tokenProvider: DriveTokenProvider;
  readonly requestTimeoutMs: number;
  readonly driveApiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "www.googleapis.com";

function assertAllowedApiUrl(url: string, driveApiHost: string): void {
  if (!url.startsWith(`${driveApiHost}/`)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive request URL is not allowed.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive request URL is invalid.",
    );
  }

  if (driveApiHost === DRIVE_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Drive request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Drive request URL is not allowed.",
      );
    }
    if (!parsed.pathname.startsWith("/drive/v3/")) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Drive request URL is not allowed.",
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
      "Google Drive request URL is not allowed.",
    );
  }
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
        "Google Drive response exceeds the connector size limit.",
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
        "Google Drive response exceeds the connector size limit.",
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
    (error as DriveHttpError).kind === "http"
  ) {
    const status = (error as DriveHttpError).status;
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

function sharedDriveQueryFlags(
  driveId: string | undefined,
  includeSharedDrives: boolean | undefined,
): {
  supportsAllDrives: boolean;
  includeItemsFromAllDrives: boolean;
  corpora?: string;
} {
  const shared = includeSharedDrives === true || driveId !== undefined;
  return {
    supportsAllDrives: shared,
    includeItemsFromAllDrives: shared,
    ...(driveId !== undefined ? { corpora: "drive" } : {}),
  };
}

export function createDriveRestClient(
  options: CreateDriveRestClientOptions,
): DriveClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const driveApiHost = options.driveApiHost ?? DRIVE_API_HOST;
  const requestTimeoutMs = options.requestTimeoutMs;

  async function requestAttempt(
    url: string,
    init: {
      readonly method: "GET";
      readonly signal?: AbortSignal;
      readonly accept: string;
      readonly maxResponseBytes: number;
    },
    attemptTimeoutMs: number,
  ): Promise<{ response: Response; bodyBytes: Uint8Array }> {
    assertAllowedApiUrl(url, driveApiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Google Drive request timed out."));
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
          Accept: init.accept,
        },
        signal: controller.signal,
      });

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

  function throwHttpError(response: Response, bodyText: string): never {
    const googleBody = parseGoogleErrorBody(bodyText);
    const retryAfterMs = parseRetryAfterMs(response);
    const httpError: DriveHttpError = {
      kind: "http",
      status: response.status,
      googleStatus: googleBody?.error?.status,
      googleMessage: googleBody?.error?.message,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
    throw httpError;
  }

  async function requestWithRetry(
    url: string,
    init: {
      readonly method: "GET";
      readonly signal?: AbortSignal;
      readonly accept: string;
      readonly maxResponseBytes: number;
    },
  ): Promise<{ response: Response; bodyBytes: Uint8Array }> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Google Drive request timed out.");
      }

      try {
        return await requestAttempt(url, init, remainingMs);
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
          (error as DriveHttpError).kind === "http"
        ) {
          const httpError = error as DriveHttpError;
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
    },
  ): Promise<T> {
    const { bodyBytes } = await requestWithRetry(url, {
      method: "GET",
      signal: init.signal,
      accept: "application/json",
      maxResponseBytes: init.maxResponseBytes ?? MAX_HTTP_RESPONSE_BYTES,
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
        "Google Drive returned invalid JSON.",
      );
    }
  }

  async function requestBytes(
    url: string,
    init: {
      readonly signal?: AbortSignal;
      readonly maxBytes: number;
    },
  ): Promise<Uint8Array> {
    const { bodyBytes } = await requestWithRetry(url, {
      method: "GET",
      signal: init.signal,
      accept: "*/*",
      maxResponseBytes: init.maxBytes,
    });

    return bodyBytes;
  }

  function encodeFileId(fileId: string): string {
    return encodeURIComponent(fileId);
  }

  return {
    listFiles(params: DriveListFilesParams) {
      const search = new URLSearchParams();
      search.set("fields", FILE_LIST_FIELDS);
      search.set("pageSize", String(params.pageSize));
      if (params.pageToken !== undefined) {
        search.set("pageToken", params.pageToken);
      }
      if (params.q !== undefined) {
        search.set("q", params.q);
      }
      if (params.orderBy !== undefined) {
        search.set("orderBy", params.orderBy);
      }
      const flags = sharedDriveQueryFlags(
        params.driveId,
        params.includeSharedDrives,
      );
      if (flags.supportsAllDrives) {
        search.set("supportsAllDrives", "true");
        search.set("includeItemsFromAllDrives", "true");
      }
      if (params.driveId !== undefined) {
        search.set("driveId", params.driveId);
        search.set("corpora", "drive");
      } else if (params.includeSharedDrives === true) {
        search.set("corpora", "user");
      }
      const url = `${driveApiHost}/files?${search.toString()}`;
      return requestJson(url, { signal: params.signal });
    },

    getFile(params: DriveGetFileParams) {
      const search = new URLSearchParams();
      search.set("fields", FILE_METADATA_FIELDS);
      search.set("supportsAllDrives", "true");
      const url = `${driveApiHost}/files/${encodeFileId(params.fileId)}?${search.toString()}`;
      return requestJson(url, { signal: params.signal });
    },

    readFileMedia(params: DriveReadFileMediaParams) {
      const search = new URLSearchParams();
      search.set("alt", "media");
      search.set("supportsAllDrives", "true");
      const url = `${driveApiHost}/files/${encodeFileId(params.fileId)}?${search.toString()}`;
      return requestBytes(url, {
        signal: params.signal,
        maxBytes: params.maxBytes,
      });
    },

    exportFile(params: DriveExportFileParams) {
      const search = new URLSearchParams();
      search.set("mimeType", params.mimeType);
      const url = `${driveApiHost}/files/${encodeFileId(params.fileId)}/export?${search.toString()}`;
      return requestBytes(url, {
        signal: params.signal,
        maxBytes: params.maxBytes,
      });
    },

    listFolderChildren(params: DriveListFolderChildrenParams) {
      const search = new URLSearchParams();
      search.set("fields", FILE_LIST_FIELDS);
      search.set("pageSize", String(params.pageSize));
      if (params.pageToken !== undefined) {
        search.set("pageToken", params.pageToken);
      }
      search.set("q", folderChildrenQuery(params.folderId));
      search.set("supportsAllDrives", "true");
      search.set("includeItemsFromAllDrives", "true");
      if (params.driveId !== undefined) {
        search.set("driveId", params.driveId);
        search.set("corpora", "drive");
      }
      const url = `${driveApiHost}/files?${search.toString()}`;
      return requestJson(url, { signal: params.signal });
    },

    listSharedDrives(params: DriveListSharedDrivesParams) {
      const search = new URLSearchParams();
      search.set("pageSize", String(params.pageSize));
      if (params.pageToken !== undefined) {
        search.set("pageToken", params.pageToken);
      }
      search.set(
        "fields",
        "nextPageToken,drives(id,name,hidden,restrictions(adminManagedRestrictions,copyRequiresWriterPermission,domainUsersOnly,driveMembersOnly))",
      );
      const url = `${driveApiHost}/drives?${search.toString()}`;
      return requestJson(url, { signal: params.signal });
    },

    getChangesStartPageToken(params: DriveChangesStartParams) {
      const search = new URLSearchParams();
      if (params.driveId !== undefined) {
        search.set("driveId", params.driveId);
        search.set("supportsAllDrives", "true");
      }
      const url = `${driveApiHost}/changes/startPageToken?${search.toString()}`;
      return requestJson(url, { signal: params.signal });
    },

    listChanges(params: DriveChangesListParams) {
      const search = new URLSearchParams();
      search.set("pageToken", params.pageToken);
      search.set("pageSize", String(params.pageSize));
      search.set(
        "fields",
        `nextPageToken,newStartPageToken,changes(fileId,removed,time,file(${CHANGE_FILE_FIELDS}))`,
      );
      search.set("supportsAllDrives", "true");
      search.set("includeItemsFromAllDrives", "true");
      if (params.driveId !== undefined) {
        search.set("driveId", params.driveId);
      }
      const url = `${driveApiHost}/changes?${search.toString()}`;
      return requestJson(url, { signal: params.signal });
    },
  };
}
