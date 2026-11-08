import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  MAX_HTTP_REQUEST_BODY_BYTES,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import { buildZendeskBasicAuthHeader } from "./zendesk-auth.js";
import type { ZendeskClient } from "./zendesk-client.js";

export interface ZendeskHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly retryAfterMs?: number;
}

const PATH_PATTERNS = [
  { method: "GET", pattern: /^\/tickets\.json$/ },
  { method: "GET", pattern: /^\/tickets\/\d+\.json$/ },
  { method: "GET", pattern: /^\/tickets\/\d+\/comments\.json$/ },
  { method: "GET", pattern: /^\/users\/\d+\.json$/ },
  { method: "GET", pattern: /^\/search\.json$/ },
  { method: "PUT", pattern: /^\/tickets\/\d+\.json$/ },
];

function assertAllowedRelativePath(method: string, pathname: string): void {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const allowed = PATH_PATTERNS.some(
    (entry) => entry.method === method && entry.pattern.test(normalized),
  );
  if (!allowed) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Zendesk request path is not supported.",
    );
  }
}

function assertAllowedApiUrl(
  pinnedOrigin: string,
  apiBaseUrl: string,
  url: string,
): void {
  const parsed = new URL(url);
  if (parsed.origin !== pinnedOrigin) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Zendesk request URL is not allowed.",
    );
  }
  const basePath = new URL(apiBaseUrl).pathname.replace(/\/$/, "");
  if (!parsed.pathname.startsWith(basePath)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Zendesk request URL is not allowed.",
    );
  }
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal | undefined,
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
        "Zendesk response exceeds the connector size limit.",
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
        "Zendesk response exceeds the connector size limit.",
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

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }
  return undefined;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export interface CreateZendeskRestClientOptions {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  readonly email: string;
  readonly apiToken: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

export function createZendeskRestClient(
  options: CreateZendeskRestClientOptions,
): ZendeskClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.apiBaseUrl.replace(/\/$/, "");
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, "");
  const authHeader = buildZendeskBasicAuthHeader(
    options.email,
    options.apiToken,
  );

  async function requestJson(
    method: string,
    relativePath: string,
    signal: AbortSignal | undefined,
    body?: Record<string, unknown>,
    query?: URLSearchParams,
  ): Promise<unknown> {
    const pathOnly = relativePath.split("?")[0] ?? relativePath;
    const relative = pathOnly.startsWith(basePath)
      ? pathOnly.slice(basePath.length) || "/"
      : pathOnly.startsWith("/")
        ? pathOnly
        : `/${pathOnly}`;
    assertAllowedRelativePath(method, relative);
    const suffix = query !== undefined ? `?${query.toString()}` : "";
    const url = `${baseUrl}${relative}${suffix}`;
    assertAllowedApiUrl(
      options.pinnedOrigin,
      baseUrl,
      url.split("?")[0] ?? url,
    );
    let bodyText: string | undefined;
    if (body !== undefined) {
      bodyText = JSON.stringify(body);
      if (Buffer.byteLength(bodyText, "utf8") > MAX_HTTP_REQUEST_BODY_BYTES) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Zendesk update payload exceeds the size limit.",
        );
      }
    }
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        options.requestTimeoutMs,
      );
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await fetchImpl(url, {
          method,
          redirect: "manual",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          ...(bodyText !== undefined ? { body: bodyText } : {}),
          signal: controller.signal,
        });
        if (response.status >= 300 && response.status < 400) {
          throw new ConnectorSdkError(
            "PROVIDER_ERROR",
            "Zendesk redirects are not followed.",
          );
        }
        const text = await readBoundedResponseText(
          response,
          MAX_HTTP_RESPONSE_BYTES,
          signal,
        );
        if (response.ok) {
          if (text.length === 0) {
            return null;
          }
          try {
            return JSON.parse(text);
          } catch {
            throw new ConnectorSdkError(
              "PROVIDER_ERROR",
              "Zendesk returned invalid JSON.",
            );
          }
        }
        const httpError: ZendeskHttpError = {
          kind: "http",
          status: response.status,
          ...(parseRetryAfterMs(response) !== undefined
            ? { retryAfterMs: parseRetryAfterMs(response) }
            : {}),
        };
        const retriable =
          method === "GET" &&
          attempt < READ_ONLY_MAX_RETRIES &&
          (response.status === 429 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504);
        if (retriable) {
          attempt += 1;
          const delay = httpError.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS;
          await sleep(delay, signal);
          continue;
        }
        throw httpError;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          if (signal?.aborted) {
            throw error;
          }
          throw new ConnectorSdkError("TIMEOUT", "Zendesk request timed out.");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  }

  return {
    listTickets: async (params, signal) => {
      const query = new URLSearchParams();
      query.set("page[size]", String(params.limit));
      if (params.cursor !== undefined) {
        query.set("page[after]", params.cursor);
      }
      const data = await requestJson(
        "GET",
        "/tickets.json",
        signal,
        undefined,
        query,
      );
      const meta =
        typeof data === "object" && data !== null
          ? (data as { meta?: { has_more?: boolean; after_cursor?: string } })
              .meta
          : undefined;
      const nextCursor =
        meta?.has_more === true && typeof meta.after_cursor === "string"
          ? meta.after_cursor
          : undefined;
      return { items: data, nextCursor };
    },
    searchTickets: async (params, signal) => {
      const query = new URLSearchParams();
      const qParts = ["type:ticket"];
      if (params.status !== undefined) {
        qParts.push(`status:${params.status}`);
      }
      if (params.updatedSince !== undefined) {
        qParts.push(`updated>${params.updatedSince}`);
      }
      query.set("query", qParts.join(" "));
      query.set("page", String(params.page));
      query.set("per_page", String(params.limit));
      const data = await requestJson(
        "GET",
        "/search.json",
        signal,
        undefined,
        query,
      );
      return { items: data };
    },
    getTicket: (ticketId, signal) =>
      requestJson("GET", `/tickets/${ticketId}.json`, signal),
    listTicketComments: async (ticketId, limit, cursor, signal) => {
      const query = new URLSearchParams();
      query.set("per_page", String(limit));
      if (cursor !== undefined) {
        query.set("page[after]", cursor);
      }
      const data = await requestJson(
        "GET",
        `/tickets/${ticketId}/comments.json`,
        signal,
        undefined,
        query,
      );
      const meta =
        typeof data === "object" && data !== null
          ? (data as { meta?: { has_more?: boolean; after_cursor?: string } })
              .meta
          : undefined;
      const nextCursor =
        meta?.has_more === true && typeof meta.after_cursor === "string"
          ? meta.after_cursor
          : undefined;
      return { items: data ?? { comments: [] }, nextCursor };
    },
    getUser: (userId, signal) =>
      requestJson("GET", `/users/${userId}.json`, signal),
    updateTicket: (ticketId, body, signal) =>
      requestJson("PUT", `/tickets/${ticketId}.json`, signal, body),
  };
}
