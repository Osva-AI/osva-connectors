import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
  SLACK_API_BASE_URL,
} from "./constants.js";
import {
  filterChannelsByAllowlist,
  mapChannelInfoResponse,
  mapChannelListResponse,
} from "./normalize-channel.js";
import {
  mapMessageHistoryResponse,
  mapPostMessageResponse,
  packMessagesWithinBudget,
} from "./normalize-message.js";
import type { SlackClient } from "./slack-client.js";

export interface SlackHttpError {
  readonly kind: "http" | "slack_api";
  readonly status?: number;
  readonly slackError?: string;
  readonly retryAfterMs?: number;
}

interface SlackEnvelope {
  readonly ok: boolean;
  readonly error?: string;
  readonly response_metadata?: { next_cursor?: string };
  readonly has_more?: boolean;
  readonly channels?: unknown;
  readonly channel?: unknown;
  readonly messages?: unknown;
  readonly team_id?: string;
  readonly team?: string;
  readonly user_id?: string;
  readonly bot_id?: string;
  readonly ts?: string;
}

export interface CreateSlackRestClientOptions {
  readonly botToken: string;
  readonly requestTimeoutMs: number;
  readonly allowedChannelIds?: readonly string[];
  /** Test-only override; production uses {@link SLACK_API_BASE_URL}. */
  readonly apiBaseUrl?: string;
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
        "Slack response exceeds the connector size limit.",
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
        "Slack response exceeds the connector size limit.",
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
    (error as SlackHttpError).kind === "http"
  ) {
    const status = (error as SlackHttpError).status;
    return status === 429 || (status !== undefined && status >= 500);
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as SlackHttpError).kind === "slack_api"
  ) {
    return (error as SlackHttpError).slackError === "ratelimited";
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

function resolveApiBaseUrl(override: string | undefined): string {
  const base = override ?? SLACK_API_BASE_URL;
  if (override === undefined && base !== SLACK_API_BASE_URL) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Slack API base URL is not configurable.",
    );
  }
  if (!base.startsWith("https://") && override === undefined) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Slack API must use HTTPS.",
    );
  }
  return base.endsWith("/") ? base : `${base}/`;
}

function buildMethodUrl(apiBaseUrl: string, method: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(method)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", "Invalid Slack API method.");
  }
  const url = `${apiBaseUrl}${method}`;
  if (
    apiBaseUrl === SLACK_API_BASE_URL &&
    !url.startsWith(SLACK_API_BASE_URL)
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack request URL is not allowed.",
    );
  }
  return url;
}

export function createSlackRestClient(
  options: CreateSlackRestClientOptions,
): SlackClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBaseUrl = resolveApiBaseUrl(options.apiBaseUrl);
  const botToken = options.botToken;
  const requestTimeoutMs = options.requestTimeoutMs;
  const allowedChannelIds = options.allowedChannelIds;

  async function postSlackAttempt<T extends SlackEnvelope>(
    method: string,
    body: Record<string, unknown>,
    attemptTimeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Slack request timed out."));
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

    const url = buildMethodUrl(apiBaseUrl, method);

    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
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
        const retryAfterMs = parseRetryAfterMs(response);
        const httpError: SlackHttpError = {
          kind: "http",
          status: response.status,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
        throw httpError;
      }

      if (text.length === 0) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Slack returned an empty response.",
        );
      }

      let parsed: T;
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Slack returned invalid JSON.",
        );
      }

      if (parsed.ok !== true) {
        const retryAfterMs =
          parsed.error === "ratelimited"
            ? parseRetryAfterMs(response)
            : undefined;
        const apiError: SlackHttpError = {
          kind: "slack_api",
          slackError: parsed.error,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
        throw apiError;
      }

      return parsed;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function postSlackRead<T extends SlackEnvelope>(
    method: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Slack request timed out.");
      }

      try {
        return await postSlackAttempt<T>(method, body, remainingMs, signal);
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
          "retryAfterMs" in error &&
          typeof (error as SlackHttpError).retryAfterMs === "number"
        ) {
          retryAfterRequested = (error as SlackHttpError).retryAfterMs;
          delayMs = retryAfterRequested ?? READ_ONLY_RETRY_DELAY_MS;
        }
        if (
          retryAfterRequested !== undefined &&
          retryAfterRequested > remainingAfterError
        ) {
          throw error;
        }
        delayMs = Math.min(delayMs, remainingAfterError);
        await sleepMs(delayMs, signal);
      }
    }
  }

  async function postSlackWrite<T extends SlackEnvelope>(
    method: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const remainingMs = requestTimeoutMs;
    return postSlackAttempt<T>(method, body, remainingMs, signal);
  }

  return {
    async authTest(params) {
      const raw = await postSlackRead<SlackEnvelope>(
        "auth.test",
        {},
        params.signal,
      );
      const teamId = raw.team_id;
      const teamName = raw.team;
      const botUserId = raw.user_id;
      if (
        typeof teamId !== "string" ||
        typeof teamName !== "string" ||
        typeof botUserId !== "string"
      ) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Slack returned an unexpected auth.test payload.",
        );
      }
      const botId = typeof raw.bot_id === "string" ? raw.bot_id : undefined;
      return {
        teamId,
        teamName,
        botUserId,
        ...(botId !== undefined ? { botId } : {}),
      };
    },

    async listChannels(params) {
      const body: Record<string, unknown> = {
        limit: params.limit,
        exclude_archived: true,
      };
      if (params.cursor !== undefined) {
        body.cursor = params.cursor;
      }
      if (params.types !== undefined && params.types.length > 0) {
        body.types = params.types.join(",");
      }
      const raw = await postSlackRead<SlackEnvelope>(
        "conversations.list",
        body,
        params.signal,
      );
      const page = mapChannelListResponse(raw);
      return filterChannelsByAllowlist(page, allowedChannelIds);
    },

    async getChannelInfo(params) {
      const raw = await postSlackRead<SlackEnvelope>(
        "conversations.info",
        { channel: params.channelId },
        params.signal,
      );
      return mapChannelInfoResponse(raw);
    },

    async getChannelHistory(params) {
      const body: Record<string, unknown> = {
        channel: params.channelId,
        limit: params.limit,
      };
      if (params.cursor !== undefined) {
        body.cursor = params.cursor;
      }
      if (params.oldest !== undefined) {
        body.oldest = params.oldest;
      }
      if (params.latest !== undefined) {
        body.latest = params.latest;
      }
      const raw = await postSlackRead<SlackEnvelope>(
        "conversations.history",
        body,
        params.signal,
      );
      return packMessagesWithinBudget(mapMessageHistoryResponse(raw));
    },

    async getThreadReplies(params) {
      const body: Record<string, unknown> = {
        channel: params.channelId,
        ts: params.threadTs,
        limit: params.limit,
      };
      if (params.cursor !== undefined) {
        body.cursor = params.cursor;
      }
      const raw = await postSlackRead<SlackEnvelope>(
        "conversations.replies",
        body,
        params.signal,
      );
      return packMessagesWithinBudget(mapMessageHistoryResponse(raw));
    },

    async postMessage(params) {
      const body: Record<string, unknown> = {
        channel: params.channelId,
        text: params.text,
      };
      if (params.threadTs !== undefined) {
        body.thread_ts = params.threadTs;
      }
      const raw = await postSlackWrite<SlackEnvelope>(
        "chat.postMessage",
        body,
        params.signal,
      );
      return mapPostMessageResponse(raw);
    },
  };
}
