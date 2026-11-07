import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GRAPH_API_HOST,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { TeamsClient } from "./teams-client.js";

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
  readonly graphApiBase?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "graph.microsoft.com";

function normalizeBase(base: string): string {
  return base.replace(/\/$/, "");
}

function assertAllowedApiUrl(url: string, apiBase: string): void {
  const base = normalizeBase(apiBase);
  const underBase = url === base || url.startsWith(`${base}/`);
  if (!underBase) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph request URL is not allowed.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph request URL is invalid.",
    );
  }

  if (apiBase === GRAPH_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph request URL is not allowed.",
      );
    }
    if (!parsed.pathname.startsWith("/v1.0/")) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph request URL is not allowed.",
      );
    }
    return;
  }

  const isLocal =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (!isLocal && parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph request URL is not allowed.",
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
): TeamsClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = normalizeBase(options.graphApiBase ?? GRAPH_API_HOST);
  const requestTimeoutMs = options.requestTimeoutMs;
  const accessToken = options.accessToken;

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
    },
    attemptTimeoutMs: number,
  ): Promise<string> {
    assertAllowedApiUrl(url, apiBase);

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
        Authorization: `Bearer ${accessToken}`,
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
        throw new Error("Microsoft Graph request timed out.");
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
    },
  ): Promise<string> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Microsoft Graph request timed out.");
    }
    return requestAttempt(
      url,
      {
        method: "POST",
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
        "Microsoft Graph returned non-JSON data.",
      );
    }
  }

  function listUrl(path: string, pageSize: number, nextLink?: string): string {
    if (nextLink !== undefined) {
      return nextLink;
    }
    const url = new URL(`${apiBase}${path}`);
    url.searchParams.set("$top", String(pageSize));
    return url.toString();
  }

  function enc(value: string): string {
    return encodeURIComponent(value);
  }

  return {
    async listJoinedTeams(params) {
      const url = listUrl("/me/joinedTeams", params.pageSize, params.nextLink);
      const text = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(text);
    },

    async listTeamChannels(params) {
      const path = `/teams/${enc(params.teamId)}/channels`;
      const url = listUrl(path, params.pageSize, params.nextLink);
      const text = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(text);
    },

    async listChannelMessages(params) {
      const path = `/teams/${enc(params.teamId)}/channels/${enc(params.channelId)}/messages`;
      const url = listUrl(path, params.pageSize, params.nextLink);
      const text = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(text);
    },

    async listChannelMessageReplies(params) {
      const path = `/teams/${enc(params.teamId)}/channels/${enc(params.channelId)}/messages/${enc(params.messageId)}/replies`;
      const url = listUrl(path, params.pageSize, params.nextLink);
      const text = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(text);
    },

    async listChats(params) {
      const url = listUrl("/me/chats", params.pageSize, params.nextLink);
      const text = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(text);
    },

    async listChatMessages(params) {
      const path = `/me/chats/${enc(params.chatId)}/messages`;
      const url = listUrl(path, params.pageSize, params.nextLink);
      const text = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(text);
    },

    async sendChannelMessage(params) {
      const path = `/teams/${enc(params.teamId)}/channels/${enc(params.channelId)}/messages`;
      const url = `${apiBase}${path}`;
      const text = await requestMutationNoRetry(url, {
        method: "POST",
        signal: params.signal,
        body: JSON.stringify(params.body),
      });
      return parseJson(text);
    },

    async sendChatMessage(params) {
      const path = `/chats/${enc(params.chatId)}/messages`;
      const url = `${apiBase}${path}`;
      const text = await requestMutationNoRetry(url, {
        method: "POST",
        signal: params.signal,
        body: JSON.stringify(params.body),
      });
      return parseJson(text);
    },
  };
}
