import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  CALENDAR_API_HOST,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { CalendarTokenProvider } from "./calendar-auth.js";
import type { CalendarClient } from "./calendar-client.js";

export interface CalendarHttpError {
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

export interface CreateCalendarRestClientOptions {
  readonly tokenProvider: CalendarTokenProvider;
  readonly requestTimeoutMs: number;
  readonly calendarApiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "www.googleapis.com";

function assertAllowedApiUrl(url: string, apiHost: string): void {
  if (!url.startsWith(`${apiHost}/`)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Calendar request URL is not allowed.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Calendar request URL is invalid.",
    );
  }

  if (apiHost === CALENDAR_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Calendar request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Calendar request URL is not allowed.",
      );
    }
    if (!parsed.pathname.startsWith("/calendar/v3/")) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Calendar request URL is not allowed.",
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
      "Google Calendar request URL is not allowed.",
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
        "Google Calendar response exceeds the connector size limit.",
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
        "Google Calendar response exceeds the connector size limit.",
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
    (error as CalendarHttpError).kind === "http"
  ) {
    const status = (error as CalendarHttpError).status;
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

function encodeCalId(calendarId: string): string {
  return encodeURIComponent(calendarId);
}

export function createCalendarRestClient(
  options: CreateCalendarRestClientOptions,
): CalendarClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = options.calendarApiHost ?? CALENDAR_API_HOST;
  const requestTimeoutMs = options.requestTimeoutMs;

  function throwHttpError(response: Response, bodyText: string): never {
    const googleBody = parseGoogleErrorBody(bodyText);
    const retryAfterMs = parseRetryAfterMs(response);
    const httpError: CalendarHttpError = {
      kind: "http",
      status: response.status,
      googleStatus: googleBody?.error?.status,
      googleMessage: googleBody?.error?.message,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
    throw httpError;
  }

  async function requestAttempt(
    url: string,
    init: {
      readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      readonly signal?: AbortSignal;
      readonly body?: string;
    },
    attemptTimeoutMs: number,
  ): Promise<string> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Google Calendar request timed out."));
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

      return bodyText;
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestWithRetry(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly signal?: AbortSignal;
      readonly body?: string;
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
        throw new Error("Google Calendar request timed out.");
      }

      try {
        return await requestAttempt(
          url,
          {
            method: init.method,
            signal: init.signal,
            ...(init.body !== undefined ? { body: init.body } : {}),
          },
          remainingMs,
        );
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
          (error as CalendarHttpError).kind === "http"
        ) {
          const httpError = error as CalendarHttpError;
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
      readonly method: "POST" | "PATCH" | "PUT" | "DELETE";
      readonly signal?: AbortSignal;
      readonly body?: string;
    },
  ): Promise<string> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Google Calendar request timed out.");
    }
    return requestAttempt(
      url,
      {
        method: init.method,
        signal: init.signal,
        ...(init.body !== undefined ? { body: init.body } : {}),
      },
      remainingMs,
    );
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
        "Google Calendar returned invalid JSON.",
      );
    }
  }

  return {
    listCalendars(params) {
      const search = new URLSearchParams();
      search.set("maxResults", String(params.maxResults));
      if (params.pageToken !== undefined) {
        search.set("pageToken", params.pageToken);
      }
      const url = `${apiHost}/users/me/calendarList?${search.toString()}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    listEvents(params) {
      const cal = encodeCalId(params.calendarId);
      const search = new URLSearchParams();
      search.set("maxResults", String(params.maxResults));
      if (params.pageToken !== undefined) {
        search.set("pageToken", params.pageToken);
      }
      if (params.timeMin !== undefined) {
        search.set("timeMin", params.timeMin);
      }
      if (params.timeMax !== undefined) {
        search.set("timeMax", params.timeMax);
      }
      if (params.singleEvents === true) {
        search.set("singleEvents", "true");
      }
      if (params.orderBy !== undefined) {
        search.set("orderBy", params.orderBy);
      }
      if (params.q !== undefined) {
        search.set("q", params.q);
      }
      const url = `${apiHost}/calendars/${cal}/events?${search.toString()}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    getEvent(params) {
      const cal = encodeCalId(params.calendarId);
      const eid = encodeURIComponent(params.eventId);
      const url = `${apiHost}/calendars/${cal}/events/${eid}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    queryFreeBusy(params) {
      const url = `${apiHost}/freeBusy`;
      const body = JSON.stringify(params.body);
      return requestWithRetry(url, {
        method: "POST",
        signal: params.signal,
        body,
      }).then(parseJson);
    },

    createEvent(params) {
      const cal = encodeCalId(params.calendarId);
      const search = new URLSearchParams();
      if (params.sendUpdates !== undefined) {
        search.set("sendUpdates", params.sendUpdates);
      }
      const qs = search.toString();
      const url = `${apiHost}/calendars/${cal}/events${qs.length > 0 ? `?${qs}` : ""}`;
      return requestMutationNoRetry(url, {
        method: "POST",
        signal: params.signal,
        body: JSON.stringify(params.body),
      }).then(parseJson);
    },

    updateEvent(params) {
      const cal = encodeCalId(params.calendarId);
      const eid = encodeURIComponent(params.eventId);
      const search = new URLSearchParams();
      if (params.sendUpdates !== undefined) {
        search.set("sendUpdates", params.sendUpdates);
      }
      const qs = search.toString();
      const url = `${apiHost}/calendars/${cal}/events/${eid}${qs.length > 0 ? `?${qs}` : ""}`;
      return requestMutationNoRetry(url, {
        method: "PATCH",
        signal: params.signal,
        body: JSON.stringify(params.body),
      }).then(parseJson);
    },

    deleteEvent(params) {
      const cal = encodeCalId(params.calendarId);
      const eid = encodeURIComponent(params.eventId);
      const search = new URLSearchParams();
      if (params.sendUpdates !== undefined) {
        search.set("sendUpdates", params.sendUpdates);
      }
      const qs = search.toString();
      const url = `${apiHost}/calendars/${cal}/events/${eid}${qs.length > 0 ? `?${qs}` : ""}`;
      return requestMutationNoRetry(url, {
        method: "DELETE",
        signal: params.signal,
      }).then((text) => (text.length === 0 ? {} : parseJson(text)));
    },
  };
}
