import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
  SUPABASE_CLIENT_INFO_HEADER,
  SUPABASE_CLIENT_INFO_VALUE,
} from "./constants.js";
import { parseOpenApiCatalog, type OpenApiCatalog } from "./openapi-catalog.js";
import { buildPostgrestFilterQuery } from "./postgrest-filters.js";
import type {
  SelectRowsResult,
  SupabaseProviderClient,
} from "./provider-client.js";

export interface SupabaseRestClientOptions {
  readonly restBaseUrl: string;
  readonly pinnedOrigin: string;
  readonly publishableKey: string;
  readonly userAccessToken: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

export interface SupabaseHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly body?: string;
}

function assertAllowedUrl(
  pinnedOrigin: string,
  restBaseUrl: string,
  url: string,
): void {
  const parsed = new URL(url);
  if (parsed.origin !== pinnedOrigin) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Supabase request URL is not allowed.",
    );
  }
  const basePath = new URL(restBaseUrl).pathname.replace(/\/$/, "");
  if (!parsed.pathname.startsWith(basePath)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Supabase request URL is not allowed.",
    );
  }
}

async function readBoundedResponseText(
  response: Response,
  signal: AbortSignal | undefined,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > MAX_HTTP_RESPONSE_BYTES) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Supabase response exceeds the connector size limit.",
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
    if (total > MAX_HTTP_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Supabase response exceeds the connector size limit.",
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

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal !== undefined) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    }
  });
}

function parseContentRange(
  header: string | null,
): Pick<SelectRowsResult, "rangeStart" | "rangeEnd" | "total"> {
  if (header === null) {
    return {};
  }
  const match = /^(\d+)-(\d+)\/(\d+|\*)$/.exec(header.trim());
  if (match === null) {
    return {};
  }
  const rangeStart = Number(match[1]);
  const rangeEnd = Number(match[2]);
  const totalRaw = match[3];
  const total = totalRaw === "*" ? undefined : Number(totalRaw);
  return {
    rangeStart,
    rangeEnd,
    ...(total !== undefined ? { total } : {}),
  };
}

function buildHeaders(
  publishableKey: string,
  userAccessToken: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${userAccessToken}`,
    Accept: "application/json",
    [SUPABASE_CLIENT_INFO_HEADER]: SUPABASE_CLIENT_INFO_VALUE,
    ...extra,
  };
}

function assertSelectColumns(columns: readonly string[]): string {
  if (columns.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Select columns must not be empty.",
    );
  }
  if (columns.some((column) => column === "*" || column.includes(","))) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Wildcard column selection is not permitted.",
    );
  }
  return columns.join(",");
}

export function createSupabaseRestClient(
  options: SupabaseRestClientOptions,
): SupabaseProviderClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request(
    method: string,
    url: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
  ): Promise<Response> {
    assertAllowedUrl(options.pinnedOrigin, options.restBaseUrl, url);
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options.requestTimeoutMs,
      );
      const linkedSignal = signal;
      if (linkedSignal !== undefined) {
        linkedSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
      try {
        const response = await fetchImpl(url, {
          ...init,
          method,
          signal: controller.signal,
        });
        if (response.status === 429 && attempt < READ_ONLY_MAX_RETRIES) {
          attempt += 1;
          await sleep(READ_ONLY_RETRY_DELAY_MS, linkedSignal);
          continue;
        }
        return response;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        if (attempt < READ_ONLY_MAX_RETRIES) {
          attempt += 1;
          await sleep(READ_ONLY_RETRY_DELAY_MS, linkedSignal);
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  async function throwHttp(
    response: Response,
    signal?: AbortSignal,
  ): Promise<never> {
    const body = await readBoundedResponseText(response, signal);
    const error: SupabaseHttpError = {
      kind: "http",
      status: response.status,
      body,
    };
    throw error;
  }

  return {
    async getOpenApiCatalog(signal): Promise<OpenApiCatalog> {
      const url = `${options.restBaseUrl.replace(/\/$/, "")}/`;
      const response = await request(
        "GET",
        url,
        {
          headers: buildHeaders(
            options.publishableKey,
            options.userAccessToken,
            { Accept: "application/openapi+json" },
          ),
        },
        signal,
      );
      if (!response.ok) {
        await throwHttp(response, signal);
      }
      const text = await readBoundedResponseText(response, signal);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Supabase OpenAPI response is not valid JSON.",
        );
      }
      return parseOpenApiCatalog(parsed);
    },

    async selectRows(params): Promise<SelectRowsResult> {
      const select = assertSelectColumns(params.columns);
      const parts = [`select=${encodeURIComponent(select)}`];
      const filterColumns = params.filterAllowColumns ?? params.columns;
      if (params.filters !== undefined && params.filters.length > 0) {
        const filterQuery = buildPostgrestFilterQuery(
          params.filters,
          filterColumns,
        );
        if (filterQuery.length > 0) {
          parts.push(filterQuery);
        }
      }
      if (params.orderColumn !== undefined) {
        const direction = params.orderAscending === false ? "desc" : "asc";
        parts.push(
          `order=${encodeURIComponent(`${params.orderColumn}.${direction}`)}`,
        );
      }
      const pathTable = encodeURIComponent(params.table);
      const url = `${options.restBaseUrl.replace(/\/$/, "")}/${pathTable}?${parts.join("&")}`;
      const rangeEnd = params.offset + params.limit - 1;
      const response = await request(
        "GET",
        url,
        {
          headers: buildHeaders(
            options.publishableKey,
            options.userAccessToken,
            {
              Range: `${params.offset}-${rangeEnd}`,
              "Accept-Profile": params.schema,
            },
          ),
        },
        params.signal,
      );
      if (!response.ok) {
        await throwHttp(response, params.signal);
      }
      const text = await readBoundedResponseText(response, params.signal);
      let rows: unknown;
      try {
        rows = text.length === 0 ? [] : JSON.parse(text);
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Supabase row payload is not valid JSON.",
        );
      }
      if (!Array.isArray(rows)) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Supabase row payload is not an array.",
        );
      }
      const contentRange = parseContentRange(
        response.headers.get("content-range"),
      );
      return {
        rows: rows.filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" &&
            entry !== null &&
            !Array.isArray(entry),
        ),
        ...contentRange,
      };
    },

    async countRows(params): Promise<number> {
      const parts: string[] = [];
      if (params.filters !== undefined && params.filters.length > 0) {
        const columns = [
          ...new Set(params.filters.map((filter) => filter.column)),
        ];
        const filterQuery = buildPostgrestFilterQuery(params.filters, columns);
        if (filterQuery.length > 0) {
          parts.push(filterQuery);
        }
      }
      const pathTable = encodeURIComponent(params.table);
      const query = parts.length > 0 ? `?${parts.join("&")}` : "";
      const url = `${options.restBaseUrl.replace(/\/$/, "")}/${pathTable}${query}`;
      const prefer = params.exact ? "count=exact" : "count=planned";
      const response = await request(
        "HEAD",
        url,
        {
          headers: buildHeaders(
            options.publishableKey,
            options.userAccessToken,
            {
              Prefer: prefer,
              "Accept-Profile": params.schema,
            },
          ),
        },
        params.signal,
      );
      if (!response.ok) {
        await throwHttp(response, params.signal);
      }
      const contentRange = response.headers.get("content-range");
      const parsed = parseContentRange(contentRange);
      if (parsed.total === undefined) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Supabase count response did not include a total.",
        );
      }
      return parsed.total;
    },
  };
}
