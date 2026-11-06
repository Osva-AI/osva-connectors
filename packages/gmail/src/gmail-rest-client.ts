import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GMAIL_API_HOST,
  GMAIL_USER_ME,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { GmailTokenProvider } from "./gmail-auth.js";
import type { GmailClient } from "./gmail-client.js";

export interface GmailHttpError {
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

export interface CreateGmailRestClientOptions {
  readonly tokenProvider: GmailTokenProvider;
  readonly requestTimeoutMs: number;
  readonly gmailApiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "gmail.googleapis.com";

function assertAllowedApiUrl(url: string, apiHost: string): void {
  if (!url.startsWith(`${apiHost}/`)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail request URL is not allowed.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail request URL is invalid.",
    );
  }

  if (apiHost === GMAIL_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Gmail request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Gmail request URL is not allowed.",
      );
    }
    if (!parsed.pathname.startsWith("/gmail/v1/")) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Gmail request URL is not allowed.",
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
      "Gmail request URL is not allowed.",
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
        "Gmail response exceeds the connector size limit.",
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
        "Gmail response exceeds the connector size limit.",
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
    (error as GmailHttpError).kind === "http"
  ) {
    const status = (error as GmailHttpError).status;
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

function userPath(apiHost: string, suffix: string): string {
  const user = encodeURIComponent(GMAIL_USER_ME);
  return `${apiHost}/users/${user}${suffix}`;
}

export function createGmailRestClient(
  options: CreateGmailRestClientOptions,
): GmailClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = options.gmailApiHost ?? GMAIL_API_HOST;
  const requestTimeoutMs = options.requestTimeoutMs;

  function throwHttpError(response: Response, bodyText: string): never {
    const googleBody = parseGoogleErrorBody(bodyText);
    const retryAfterMs = parseRetryAfterMs(response);
    const httpError: GmailHttpError = {
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
      readonly method: "GET" | "POST" | "PUT";
      readonly signal?: AbortSignal;
      readonly body?: string;
    },
    attemptTimeoutMs: number,
  ): Promise<string> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Gmail request timed out."));
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
      readonly method: "GET";
      readonly signal?: AbortSignal;
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
        throw new Error("Gmail request timed out.");
      }

      try {
        return await requestAttempt(
          url,
          { method: "GET", signal: init.signal },
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
          (error as GmailHttpError).kind === "http"
        ) {
          const httpError = error as GmailHttpError;
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
      readonly method: "POST" | "PUT";
      readonly signal?: AbortSignal;
      readonly body: string;
    },
  ): Promise<string> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Gmail request timed out.");
    }
    return requestAttempt(
      url,
      {
        method: init.method,
        signal: init.signal,
        body: init.body,
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
        "Gmail returned invalid JSON.",
      );
    }
  }

  return {
    getProfile(params) {
      const url = userPath(apiHost, "/profile");
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    listMessages(init) {
      const search = new URLSearchParams();
      search.set("maxResults", String(init.maxResults));
      if (init.pageToken !== undefined) {
        search.set("pageToken", init.pageToken);
      }
      if (init.q !== undefined) {
        search.set("q", init.q);
      }
      if (init.includeSpamTrash === true) {
        search.set("includeSpamTrash", "true");
      }
      if (init.labelIds !== undefined) {
        for (const id of init.labelIds) {
          search.append("labelIds", id);
        }
      }
      const url = `${userPath(apiHost, "/messages")}?${search.toString()}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: init.signal,
      }).then(parseJson);
    },

    getMessage(init) {
      const id = encodeURIComponent(init.messageId);
      const search = new URLSearchParams();
      search.set("format", init.format);
      if (init.metadataHeaders !== undefined) {
        for (const h of init.metadataHeaders) {
          search.append("metadataHeaders", h);
        }
      }
      const url = `${userPath(apiHost, `/messages/${id}`)}?${search.toString()}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: init.signal,
      }).then(parseJson);
    },

    listThreads(init) {
      const search = new URLSearchParams();
      search.set("maxResults", String(init.maxResults));
      if (init.pageToken !== undefined) {
        search.set("pageToken", init.pageToken);
      }
      if (init.q !== undefined) {
        search.set("q", init.q);
      }
      if (init.includeSpamTrash === true) {
        search.set("includeSpamTrash", "true");
      }
      if (init.labelIds !== undefined) {
        for (const id of init.labelIds) {
          search.append("labelIds", id);
        }
      }
      const url = `${userPath(apiHost, "/threads")}?${search.toString()}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: init.signal,
      }).then(parseJson);
    },

    getThread(init) {
      const id = encodeURIComponent(init.threadId);
      const search = new URLSearchParams();
      search.set("format", init.format);
      if (init.metadataHeaders !== undefined) {
        for (const h of init.metadataHeaders) {
          search.append("metadataHeaders", h);
        }
      }
      const url = `${userPath(apiHost, `/threads/${id}`)}?${search.toString()}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: init.signal,
      }).then(parseJson);
    },

    listLabels(params) {
      const url = userPath(apiHost, "/labels");
      return requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      }).then(parseJson);
    },

    listDrafts(init) {
      const search = new URLSearchParams();
      search.set("maxResults", String(init.maxResults));
      if (init.pageToken !== undefined) {
        search.set("pageToken", init.pageToken);
      }
      const url = `${userPath(apiHost, "/drafts")}?${search.toString()}`;
      return requestWithRetry(url, {
        method: "GET",
        signal: init.signal,
      }).then(parseJson);
    },

    createDraft(init) {
      const url = userPath(apiHost, "/drafts");
      return requestMutationNoRetry(url, {
        method: "POST",
        signal: init.signal,
        body: JSON.stringify(init.body),
      }).then(parseJson);
    },

    updateDraft(init) {
      const id = encodeURIComponent(init.draftId);
      const url = userPath(apiHost, `/drafts/${id}`);
      return requestMutationNoRetry(url, {
        method: "PUT",
        signal: init.signal,
        body: JSON.stringify(init.body),
      }).then(parseJson);
    },

    sendMessage(init) {
      const url = userPath(apiHost, "/messages/send");
      return requestMutationNoRetry(url, {
        method: "POST",
        signal: init.signal,
        body: JSON.stringify(init.body),
      }).then(parseJson);
    },
  };
}
