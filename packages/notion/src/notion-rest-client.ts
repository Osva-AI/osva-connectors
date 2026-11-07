import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  NOTION_API_HOST,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import {
  formatNotionIdForApi,
  parseNotionId,
  validatePaginationCursor,
} from "./notion-id.js";
import type {
  NotionAppendChildrenParams,
  NotionClient,
  NotionDataSourceQueryParams,
  NotionListChildrenParams,
  NotionListChildrenResult,
  NotionPageCreateParams,
  NotionPageUpdateParams,
  NotionSearchParams,
  NotionSearchResult,
} from "./notion-client.js";

export interface NotionHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly notionCode?: string;
  readonly notionMessage?: string;
  readonly retryAfterMs?: number;
}

interface NotionErrorBody {
  readonly object?: string;
  readonly status?: number;
  readonly code?: string;
  readonly message?: string;
}

export interface CreateNotionRestClientOptions {
  readonly accessToken: string;
  readonly requestTimeoutMs: number;
  readonly apiVersion: string;
  readonly apiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "api.notion.com";

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Notion request URL is invalid.",
    );
  }

  const onApi =
    url === apiHost ||
    url.startsWith(`${apiHost}/`) ||
    url.startsWith(`${apiHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Notion request URL is not allowed.",
    );
  }

  if (apiHost === NOTION_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Notion request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Notion request URL is not allowed.",
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
      "Notion request URL is not allowed.",
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
        "Notion response exceeds the connector size limit.",
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
        "Notion response exceeds the connector size limit.",
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

function parseNotionErrorBody(text: string): NotionErrorBody | undefined {
  try {
    return JSON.parse(text) as NotionErrorBody;
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
    (error as NotionHttpError).kind === "http"
  ) {
    const status = (error as NotionHttpError).status;
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

function parseListResponse(body: unknown): NotionSearchResult {
  if (body === null || typeof body !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Notion returned an unexpected payload.",
    );
  }
  const record = body as Record<string, unknown>;
  const results = record.results;
  if (!Array.isArray(results)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Notion returned an unexpected payload.",
    );
  }
  const hasMore = record.has_more === true;
  const nextCursor =
    typeof record.next_cursor === "string" && record.next_cursor.length > 0
      ? record.next_cursor
      : undefined;
  const requestStatus = record.request_status;
  return {
    results,
    hasMore,
    ...(nextCursor !== undefined ? { nextCursor } : {}),
    ...(requestStatus !== undefined ? { requestStatus } : {}),
  };
}

export function createNotionRestClient(
  options: CreateNotionRestClientOptions,
): NotionClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? NOTION_API_HOST).replace(/\/$/, "");
  const apiVersion = options.apiVersion;
  const requestTimeoutMs = options.requestTimeoutMs;
  const accessToken = options.accessToken.trim();

  async function requestJsonAttempt<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST" | "PATCH";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Notion request timed out."));
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
      const response = await fetchImpl(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Notion-Version": apiVersion,
          ...(init.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const parsed = parseNotionErrorBody(text);
        const httpError: NotionHttpError = {
          kind: "http",
          status: response.status,
          ...(parsed?.code !== undefined ? { notionCode: parsed.code } : {}),
          ...(parsed?.message !== undefined
            ? { notionMessage: parsed.message }
            : {}),
          ...(parseRetryAfterMs(response) !== undefined
            ? { retryAfterMs: parseRetryAfterMs(response) }
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
          "Notion returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (init.signal !== undefined) {
        init.signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async function requestJsonWithReadRetries<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await requestJsonAttempt<T>(url, init, requestTimeoutMs);
      } catch (error) {
        const canRetry =
          attempt < READ_ONLY_MAX_RETRIES &&
          (isRetryableHttpError(error) || isRetryableNetworkError(error));
        if (!canRetry) {
          throw error;
        }
        attempt += 1;
        const retryAfter =
          error !== null &&
          typeof error === "object" &&
          "kind" in error &&
          (error as NotionHttpError).kind === "http"
            ? (error as NotionHttpError).retryAfterMs
            : undefined;
        await sleepMs(retryAfter ?? READ_ONLY_RETRY_DELAY_MS, init.signal);
      }
    }
  }

  async function requestJsonMutation<T>(
    url: string,
    init: {
      readonly method: "POST" | "PATCH";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<T> {
    return requestJsonAttempt<T>(url, init, requestTimeoutMs);
  }

  return {
    async search(params: NotionSearchParams): Promise<NotionSearchResult> {
      const url = `${apiHost}/v1/search`;
      assertAllowedApiUrl(url, apiHost);
      const body: Record<string, unknown> = {
        page_size: params.pageSize,
      };
      if (params.query !== undefined && params.query.length > 0) {
        body.query = params.query;
      }
      const cursor = validatePaginationCursor(params.startCursor);
      if (cursor !== undefined) {
        body.start_cursor = cursor;
      }
      if (params.filter !== undefined) {
        body.filter = { property: "object", value: params.filter.value };
      }
      const parsed = await requestJsonWithReadRetries<unknown>(url, {
        method: "POST",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      return parseListResponse(parsed);
    },

    async getPage(pageId: string, signal?: AbortSignal): Promise<unknown> {
      const canonical = formatNotionIdForApi(parseNotionId(pageId, "page ID"));
      const url = `${apiHost}/v1/pages/${canonical}`;
      assertAllowedApiUrl(url, apiHost);
      return requestJsonWithReadRetries(url, {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    },

    async listBlockChildren(
      params: NotionListChildrenParams,
    ): Promise<NotionListChildrenResult> {
      const canonical = formatNotionIdForApi(
        parseNotionId(params.blockId, "block ID"),
      );
      const url = new URL(`${apiHost}/v1/blocks/${canonical}/children`);
      url.searchParams.set("page_size", String(params.pageSize));
      const cursor = validatePaginationCursor(params.startCursor);
      if (cursor !== undefined) {
        url.searchParams.set("start_cursor", cursor);
      }
      assertAllowedApiUrl(url.toString(), apiHost);
      const parsed = await requestJsonWithReadRetries<unknown>(url.toString(), {
        method: "GET",
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      const result = parseListResponse(parsed);
      return {
        results: result.results,
        hasMore: result.hasMore,
        ...(result.nextCursor !== undefined
          ? { nextCursor: result.nextCursor }
          : {}),
      };
    },

    async getDatabase(
      databaseId: string,
      signal?: AbortSignal,
    ): Promise<unknown> {
      const canonical = formatNotionIdForApi(
        parseNotionId(databaseId, "database ID"),
      );
      const url = `${apiHost}/v1/databases/${canonical}`;
      assertAllowedApiUrl(url, apiHost);
      return requestJsonWithReadRetries(url, {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    },

    async getDataSource(
      dataSourceId: string,
      signal?: AbortSignal,
    ): Promise<unknown> {
      const canonical = formatNotionIdForApi(
        parseNotionId(dataSourceId, "data source ID"),
      );
      const url = `${apiHost}/v1/data_sources/${canonical}`;
      assertAllowedApiUrl(url, apiHost);
      return requestJsonWithReadRetries(url, {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    },

    async queryDataSource(
      params: NotionDataSourceQueryParams,
    ): Promise<NotionSearchResult> {
      const canonical = formatNotionIdForApi(
        parseNotionId(params.dataSourceId, "data source ID"),
      );
      const url = new URL(`${apiHost}/v1/data_sources/${canonical}/query`);
      if (params.filterProperties !== undefined) {
        for (const prop of params.filterProperties) {
          url.searchParams.append("filter_properties", prop);
        }
      }
      assertAllowedApiUrl(url.toString(), apiHost);
      const body: Record<string, unknown> = {
        page_size: params.pageSize,
      };
      const cursor = validatePaginationCursor(params.startCursor);
      if (cursor !== undefined) {
        body.start_cursor = cursor;
      }
      if (params.filter !== undefined) {
        body.filter = params.filter;
      }
      if (params.sorts !== undefined) {
        body.sorts = params.sorts;
      }
      const parsed = await requestJsonWithReadRetries<unknown>(url.toString(), {
        method: "POST",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      return parseListResponse(parsed);
    },

    async createPage(params: NotionPageCreateParams): Promise<unknown> {
      const url = `${apiHost}/v1/pages`;
      assertAllowedApiUrl(url, apiHost);
      const parent: Record<string, unknown> = { type: params.parent.type };
      if (params.parent.type === "page_id") {
        parent.page_id = formatNotionIdForApi(
          parseNotionId(params.parent.pageId, "parent page ID"),
        );
      } else if (params.parent.type === "database_id") {
        parent.database_id = formatNotionIdForApi(
          parseNotionId(params.parent.databaseId, "parent database ID"),
        );
      } else {
        parent.data_source_id = formatNotionIdForApi(
          parseNotionId(params.parent.dataSourceId, "parent data source ID"),
        );
      }
      const body: Record<string, unknown> = { parent };
      if (params.properties !== undefined) {
        body.properties = params.properties;
      }
      if (params.children !== undefined) {
        body.children = params.children;
      }
      return requestJsonMutation(url, {
        method: "POST",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },

    async updatePage(params: NotionPageUpdateParams): Promise<unknown> {
      const canonical = formatNotionIdForApi(
        parseNotionId(params.pageId, "page ID"),
      );
      const url = `${apiHost}/v1/pages/${canonical}`;
      assertAllowedApiUrl(url, apiHost);
      const body: Record<string, unknown> = {};
      if (params.properties !== undefined) {
        body.properties = params.properties;
      }
      if (params.inTrash !== undefined) {
        if (apiVersion === "2026-03-11") {
          body.in_trash = params.inTrash;
        } else {
          body.archived = params.inTrash;
        }
      }
      return requestJsonMutation(url, {
        method: "PATCH",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },

    async appendBlockChildren(
      params: NotionAppendChildrenParams,
    ): Promise<unknown> {
      const canonical = formatNotionIdForApi(
        parseNotionId(params.blockId, "block ID"),
      );
      const url = `${apiHost}/v1/blocks/${canonical}/children`;
      assertAllowedApiUrl(url, apiHost);
      const body: Record<string, unknown> = {
        children: params.children,
      };
      if (params.position !== undefined) {
        if (params.position.type === "after_block") {
          body.position = {
            type: "after_block",
            after_block: {
              id: formatNotionIdForApi(
                parseNotionId(
                  params.position.afterBlockId,
                  "after_block block ID",
                ),
              ),
            },
          };
        } else {
          body.position = { type: params.position.type };
        }
      }
      return requestJsonMutation(url, {
        method: "PATCH",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },
  };
}
