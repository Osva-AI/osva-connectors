import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  KLAVIYO_API_HOST,
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_PAGINATION_PAGES,
} from "./constants.js";
import { parseKlaviyoListResponse } from "./pagination.js";

export type KlaviyoListFetcher = (params: {
  readonly pageSize: number;
  readonly pageCursor?: string;
  readonly signal?: AbortSignal;
}) => Promise<unknown>;

export interface FetchKlaviyoListBoundedOptions {
  readonly fetchPage: KlaviyoListFetcher;
  readonly limit: number;
  readonly pageCursor?: string;
  readonly signal?: AbortSignal;
  readonly apiHost?: string;
  readonly maxPageSize?: number;
}

export async function fetchKlaviyoListBounded(
  options: FetchKlaviyoListBoundedOptions,
): Promise<{
  rows: unknown[];
  nextCursor: string | undefined;
  pagesFetched: number;
  rowsTruncated: boolean;
}> {
  const apiHost = options.apiHost ?? KLAVIYO_API_HOST;
  const maxPageSize = options.maxPageSize ?? LIST_MAX_PAGE_SIZE;
  const targetLimit = Math.max(1, options.limit);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(LIST_DEFAULT_PAGE_SIZE, Math.min(targetLimit, maxPageSize)),
  );

  const rows: unknown[] = [];
  let cursor = options.pageCursor;
  let pagesFetched = 0;
  let lastNextCursor: string | undefined;

  while (rows.length < targetLimit && pagesFetched < MAX_PAGINATION_PAGES) {
    pagesFetched += 1;
    const raw = await options.fetchPage({
      pageSize: Math.min(pageSize, targetLimit - rows.length),
      ...(cursor !== undefined ? { pageCursor: cursor } : {}),
      signal: options.signal,
    });
    const parsed = parseKlaviyoListResponse(raw, apiHost);
    rows.push(...parsed.data);
    lastNextCursor = parsed.nextCursor;
    if (rows.length >= targetLimit) {
      break;
    }
    if (parsed.nextCursor === undefined) {
      lastNextCursor = undefined;
      break;
    }
    cursor = parsed.nextCursor;
  }

  const bounded = rows.slice(0, targetLimit);
  if (bounded.length === 0 && rows.length > 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo list response could not be normalized within output limits.",
    );
  }

  const nextCursor =
    bounded.length >= targetLimit && lastNextCursor !== undefined
      ? lastNextCursor
      : undefined;

  return {
    rows: bounded,
    nextCursor,
    pagesFetched,
    rowsTruncated: nextCursor !== undefined,
  };
}
