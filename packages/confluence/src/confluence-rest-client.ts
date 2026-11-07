import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  ATLASSIAN_GATEWAY_ORIGIN,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import {
  parseConfluenceId,
  validatePaginationCursor,
} from "./confluence-id.js";
import type {
  ConfluenceClient,
  ConfluenceListResult,
  ConfluencePageChildrenListParams,
  ConfluencePageCreateParams,
  ConfluencePageListParams,
  ConfluencePageUpdateParams,
  ConfluenceSearchParams,
  ConfluenceSpaceListParams,
} from "./confluence-client.js";
import {
  parseConfluenceRestSearchResponse,
  parseConfluenceV2ListResponse,
} from "./pagination.js";

export interface ConfluenceHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly message?: string;
  readonly retryAfterMs?: number;
}

interface ConfluenceErrorBody {
  readonly message?: string;
  readonly statusCode?: number;
}

export interface CreateConfluenceRestClientOptions {
  readonly apiBaseV2: string;
  readonly apiBaseRest: string;
  readonly authorizationHeader: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

function normalizeBase(base: string): string {
  return base.replace(/\/$/, "");
}

function allowedOriginsForBases(
  apiBaseV2: string,
  apiBaseRest: string,
): string[] {
  const v2 = new URL(normalizeBase(apiBaseV2));
  const rest = new URL(normalizeBase(apiBaseRest));
  const origins = new Set<string>([
    `${v2.protocol}//${v2.host}`,
    `${rest.protocol}//${rest.host}`,
    ATLASSIAN_GATEWAY_ORIGIN,
  ]);
  return [...origins];
}

function assertAllowedRequestUrl(
  url: string,
  allowedBases: readonly string[],
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence request URL is invalid.",
    );
  }

  const prefixes = allowedBases.map((base) => normalizeBase(base));
  const allowed = prefixes.some(
    (base) => url === base || url.startsWith(`${base}/`),
  );
  if (!allowed) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence request URL is not allowed.",
    );
  }

  const isGateway = parsed.origin === ATLASSIAN_GATEWAY_ORIGIN;
  const isLocal =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";

  if (isLocal) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Confluence request URL is not allowed.",
      );
    }
    return;
  }

  if (!isGateway && parsed.protocol !== "https:") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence request URL is not allowed.",
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
        "Confluence response exceeds the connector size limit.",
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
        "Confluence response exceeds the connector size limit.",
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

function parseErrorBody(text: string): ConfluenceErrorBody | undefined {
  try {
    return JSON.parse(text) as ConfluenceErrorBody;
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
    (error as ConfluenceHttpError).kind === "http"
  ) {
    const status = (error as ConfluenceHttpError).status;
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

export function createConfluenceRestClient(
  options: CreateConfluenceRestClientOptions,
): ConfluenceClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBaseV2 = normalizeBase(options.apiBaseV2);
  const apiBaseRest = normalizeBase(options.apiBaseRest);
  const allowedBases = [apiBaseV2, apiBaseRest];
  const paginationOrigins = allowedOriginsForBases(apiBaseV2, apiBaseRest);
  const requestTimeoutMs = options.requestTimeoutMs;
  const authorizationHeader = options.authorizationHeader.trim();

  async function requestJsonAttempt<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST" | "PUT";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedRequestUrl(url, allowedBases);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Confluence request timed out."));
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
          Authorization: authorizationHeader,
          Accept: "application/json",
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
        const parsed = parseErrorBody(text);
        const httpError: ConfluenceHttpError = {
          kind: "http",
          status: response.status,
          ...(parsed?.message !== undefined ? { message: parsed.message } : {}),
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
          "Confluence returned invalid JSON.",
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
          (error as ConfluenceHttpError).kind === "http"
            ? (error as ConfluenceHttpError).retryAfterMs
            : undefined;
        await sleepMs(retryAfter ?? READ_ONLY_RETRY_DELAY_MS, init.signal);
      }
    }
  }

  async function requestJsonMutation<T>(
    url: string,
    init: {
      readonly method: "POST" | "PUT";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<T> {
    return requestJsonAttempt<T>(url, init, requestTimeoutMs);
  }

  function toListResult(parsed: {
    results: unknown[];
    nextCursor: string | undefined;
  }): ConfluenceListResult {
    return {
      results: parsed.results,
      ...(parsed.nextCursor !== undefined
        ? { nextCursor: parsed.nextCursor }
        : {}),
    };
  }

  return {
    async listSpaces(
      params: ConfluenceSpaceListParams,
    ): Promise<ConfluenceListResult> {
      const url = new URL(`${apiBaseV2}/spaces`);
      if (params.limit !== undefined) {
        url.searchParams.set("limit", String(params.limit));
      }
      const cursor = validatePaginationCursor(params.cursor);
      if (cursor !== undefined) {
        url.searchParams.set("cursor", cursor);
      }
      const raw = await requestJsonWithReadRetries(url.toString(), {
        method: "GET",
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      return toListResult(
        parseConfluenceV2ListResponse(raw, paginationOrigins),
      );
    },

    async getSpace(spaceId: string, signal?: AbortSignal): Promise<unknown> {
      const canonical = parseConfluenceId(spaceId, "space ID");
      const url = `${apiBaseV2}/spaces/${canonical}`;
      return requestJsonWithReadRetries(url, {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    },

    async listPages(
      params: ConfluencePageListParams,
    ): Promise<ConfluenceListResult> {
      const spaceId = parseConfluenceId(params.spaceId, "space ID");
      const url = new URL(`${apiBaseV2}/pages`);
      url.searchParams.set("space-id", spaceId);
      if (params.limit !== undefined) {
        url.searchParams.set("limit", String(params.limit));
      }
      const cursor = validatePaginationCursor(params.cursor);
      if (cursor !== undefined) {
        url.searchParams.set("cursor", cursor);
      }
      const raw = await requestJsonWithReadRetries(url.toString(), {
        method: "GET",
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      return toListResult(
        parseConfluenceV2ListResponse(raw, paginationOrigins),
      );
    },

    async getPage(pageId: string, signal?: AbortSignal): Promise<unknown> {
      const canonical = parseConfluenceId(pageId, "page ID");
      const url = new URL(`${apiBaseV2}/pages/${canonical}`);
      url.searchParams.set("body-format", "storage");
      return requestJsonWithReadRetries(url.toString(), {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    },

    async listPageChildren(
      params: ConfluencePageChildrenListParams,
    ): Promise<ConfluenceListResult> {
      const pageId = parseConfluenceId(params.pageId, "page ID");
      const url = new URL(`${apiBaseV2}/pages/${pageId}/children`);
      if (params.limit !== undefined) {
        url.searchParams.set("limit", String(params.limit));
      }
      const cursor = validatePaginationCursor(params.cursor);
      if (cursor !== undefined) {
        url.searchParams.set("cursor", cursor);
      }
      const raw = await requestJsonWithReadRetries(url.toString(), {
        method: "GET",
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      return toListResult(
        parseConfluenceV2ListResponse(raw, paginationOrigins),
      );
    },

    async search(
      params: ConfluenceSearchParams,
    ): Promise<ConfluenceListResult> {
      const url = new URL(`${apiBaseRest}/search`);
      url.searchParams.set("cql", params.cql);
      if (params.limit !== undefined) {
        url.searchParams.set("limit", String(params.limit));
      }
      const cursor = validatePaginationCursor(params.cursor);
      if (cursor !== undefined) {
        url.searchParams.set("cursor", cursor);
      }
      const raw = await requestJsonWithReadRetries(url.toString(), {
        method: "GET",
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      return toListResult(
        parseConfluenceRestSearchResponse(raw, paginationOrigins),
      );
    },

    async createPage(params: ConfluencePageCreateParams): Promise<unknown> {
      const url = `${apiBaseV2}/pages`;
      const spaceId = parseConfluenceId(params.spaceId, "space ID");
      const body: Record<string, unknown> = {
        spaceId,
        status: "current",
        title: params.title,
        body: {
          representation: "storage",
          value: params.bodyStorage,
        },
      };
      if (params.parentId !== undefined) {
        body.parentId = parseConfluenceId(params.parentId, "parent page ID");
      }
      return requestJsonMutation(url, {
        method: "POST",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },

    async updatePage(params: ConfluencePageUpdateParams): Promise<unknown> {
      const pageId = parseConfluenceId(params.pageId, "page ID");
      const url = `${apiBaseV2}/pages/${pageId}`;
      const body: Record<string, unknown> = {
        id: pageId,
        status: "current",
        version: {
          number: params.versionNumber,
          ...(params.versionMessage !== undefined
            ? { message: params.versionMessage }
            : {}),
        },
      };
      if (params.title !== undefined) {
        body.title = params.title;
      }
      if (params.bodyStorage !== undefined) {
        body.body = {
          representation: "storage",
          value: params.bodyStorage,
        };
      }
      return requestJsonMutation(url, {
        method: "PUT",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },
  };
}
