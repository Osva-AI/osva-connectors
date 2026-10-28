import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_PAGINATION_PAGES,
  STRIPE_API_HOST,
} from "./constants.js";
import { nextCursorFromList, parseStripeListResponse } from "./pagination.js";

export type StripeListFetcher = (params: {
  readonly limit: number;
  readonly startingAfter?: string;
  readonly signal?: AbortSignal;
}) => Promise<unknown>;

export interface FetchStripeListBoundedOptions {
  readonly fetchPage: StripeListFetcher;
  readonly limit: number;
  readonly startingAfter?: string;
  readonly signal?: AbortSignal;
  readonly apiHost?: string;
  readonly maxPageSize?: number;
}

export async function fetchStripeListBounded(
  options: FetchStripeListBoundedOptions,
): Promise<{
  rows: unknown[];
  nextCursor: string | undefined;
  pagesFetched: number;
  rowsTruncated: boolean;
}> {
  const apiHost = options.apiHost ?? STRIPE_API_HOST;
  const maxPageSize = options.maxPageSize ?? LIST_MAX_PAGE_SIZE;
  const targetLimit = Math.max(1, options.limit);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(LIST_DEFAULT_PAGE_SIZE, Math.min(targetLimit, maxPageSize)),
  );

  const rows: unknown[] = [];
  let cursor = options.startingAfter;
  let pagesFetched = 0;
  let lastNextCursor: string | undefined;

  while (rows.length < targetLimit && pagesFetched < MAX_PAGINATION_PAGES) {
    pagesFetched += 1;
    const raw = await options.fetchPage({
      limit: Math.min(pageSize, targetLimit - rows.length),
      ...(cursor !== undefined ? { startingAfter: cursor } : {}),
      signal: options.signal,
    });
    const parsed = parseStripeListResponse(raw, apiHost);
    rows.push(...parsed.data);
    lastNextCursor = nextCursorFromList(parsed.hasMore, parsed.lastId);
    if (rows.length >= targetLimit) {
      break;
    }
    if (lastNextCursor === undefined) {
      break;
    }
    cursor = lastNextCursor;
  }

  const bounded = rows.slice(0, targetLimit);
  if (bounded.length === 0 && rows.length > 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe list response could not be normalized within output limits.",
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
