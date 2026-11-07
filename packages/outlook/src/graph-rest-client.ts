import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GRAPH_API_HOST,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import { parseBoundedSearchQuery, parseGraphResourceId } from "./graph-id.js";
import { assertAllowedGraphUrl } from "./graph-pagination.js";
import type { OutlookClient, OutlookListParams } from "./outlook-client.js";

export interface GraphHttpError {
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

export interface CreateGraphRestClientOptions {
  readonly accessToken: string;
  readonly requestTimeoutMs: number;
  readonly graphApiHost?: string;
  readonly fetchImpl?: typeof fetch;
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
        "Microsoft Graph response exceeds the connector size limit.",
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
        "Microsoft Graph response exceeds the connector size limit.",
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
    (error as GraphHttpError).kind === "http"
  ) {
    const status = (error as GraphHttpError).status;
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

export function createGraphRestClient(
  options: CreateGraphRestClientOptions,
): OutlookClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const graphApiHost = options.graphApiHost ?? GRAPH_API_HOST;
  const requestTimeoutMs = options.requestTimeoutMs;
  const bearer = `Bearer ${options.accessToken.trim()}`;

  function mePath(suffix: string): string {
    return `${graphApiHost}/me${suffix}`;
  }

  function throwHttpError(response: Response, bodyText: string): never {
    const graphBody = parseGraphErrorBody(bodyText);
    const retryAfterMs = parseRetryAfterMs(response);
    const httpError: GraphHttpError = {
      kind: "http",
      status: response.status,
      graphCode: graphBody?.error?.code,
      graphMessage: graphBody?.error?.message,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
    throw httpError;
  }

  async function requestAttempt(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly signal?: AbortSignal;
      readonly body?: string;
      readonly extraHeaders?: Record<string, string>;
    },
    attemptTimeoutMs: number,
  ): Promise<{ status: number; bodyText: string }> {
    assertAllowedGraphUrl(url, graphApiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Microsoft Graph request timed out."));
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
        Authorization: bearer,
        Accept: "application/json",
        ...(init.extraHeaders ?? {}),
      };
      if (init.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetchImpl(url, {
        method: init.method,
        headers,
        ...(init.body !== undefined ? { body: init.body } : {}),
        signal: controller.signal,
      });

      const bodyText = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        throwHttpError(response, bodyText);
      }

      return { status: response.status, bodyText };
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestWithRetry(
    url: string,
    init: {
      readonly method: "GET";
      readonly signal?: AbortSignal;
      readonly extraHeaders?: Record<string, string>;
    },
  ): Promise<string> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Microsoft Graph request timed out.");
      }

      try {
        const result = await requestAttempt(
          url,
          {
            method: "GET",
            signal: init.signal,
            ...(init.extraHeaders !== undefined
              ? { extraHeaders: init.extraHeaders }
              : {}),
          },
          remainingMs,
        );
        return result.bodyText;
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
          (error as GraphHttpError).kind === "http"
        ) {
          const httpError = error as GraphHttpError;
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

  async function requestMutationNoRetry(
    url: string,
    init: {
      readonly method: "POST";
      readonly signal?: AbortSignal;
      readonly body: string;
      readonly acceptStatus?: readonly number[];
    },
  ): Promise<{ status: number; bodyText: string }> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Microsoft Graph request timed out.");
    }

    assertAllowedGraphUrl(url, graphApiHost);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Microsoft Graph request timed out."));
    }, remainingMs);

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
          Authorization: bearer,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: init.body,
        signal: controller.signal,
      });

      const bodyText = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      const accepted = init.acceptStatus ?? [200, 201, 204];
      if (!accepted.includes(response.status)) {
        throwHttpError(response, bodyText);
      }

      return { status: response.status, bodyText };
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  function parseJson(bodyText: string): unknown {
    if (bodyText.length === 0) {
      return {};
    }
    try {
      return JSON.parse(bodyText) as unknown;
    } catch {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph returned invalid JSON.",
      );
    }
  }

  function listUrl(params: OutlookListParams): string {
    if (params.nextLink !== undefined) {
      assertAllowedGraphUrl(params.nextLink, graphApiHost);
      return params.nextLink;
    }
    const search = new URLSearchParams();
    search.set("$top", String(params.top));
    return `?${search.toString()}`;
  }

  return {
    listMailFolders(params) {
      const url =
        params.nextLink !== undefined
          ? params.nextLink
          : `${mePath("/mailFolders")}${listUrl(params)}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    listMessages(params) {
      const folderId = encodeURIComponent(
        parseGraphResourceId(params.mailFolderId, "mail folder ID"),
      );
      const url =
        params.nextLink !== undefined
          ? params.nextLink
          : `${mePath(`/mailFolders/${folderId}/messages`)}${listUrl(params)}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    getMessage(params) {
      const id = encodeURIComponent(
        parseGraphResourceId(params.messageId, "message ID"),
      );
      const url = mePath(`/messages/${id}`);
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
        extraHeaders: {
          Prefer: 'outlook.body-content-type="text"',
        },
      }).then(parseJson);
    },

    searchMessages(params) {
      const query = parseBoundedSearchQuery(params.query);
      const url =
        params.nextLink !== undefined
          ? params.nextLink
          : `${mePath("/messages")}?$top=${params.top}&$search=${encodeURIComponent(`"${query}"`)}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    listCalendars(params) {
      const url =
        params.nextLink !== undefined
          ? params.nextLink
          : `${mePath("/calendars")}${listUrl(params)}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    listEvents(params) {
      const calendarId = encodeURIComponent(
        parseGraphResourceId(params.calendarId, "calendar ID"),
      );
      const url =
        params.nextLink !== undefined
          ? params.nextLink
          : `${mePath(`/calendars/${calendarId}/events`)}${listUrl(params)}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    getEvent(params) {
      const id = encodeURIComponent(
        parseGraphResourceId(params.eventId, "event ID"),
      );
      const url = mePath(`/events/${id}`);
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    async sendMail(params) {
      const result = await requestMutationNoRetry(mePath("/sendMail"), {
        method: "POST",
        signal: params.signal,
        body: JSON.stringify(params.body),
        acceptStatus: [202],
      });
      return parseJson(result.bodyText);
    },

    async createEvent(params) {
      const calendarId = encodeURIComponent(
        parseGraphResourceId(params.calendarId, "calendar ID"),
      );
      const result = await requestMutationNoRetry(
        mePath(`/calendars/${calendarId}/events`),
        {
          method: "POST",
          signal: params.signal,
          body: JSON.stringify(params.body),
          acceptStatus: [201],
        },
      );
      return parseJson(result.bodyText);
    },
  };
}
