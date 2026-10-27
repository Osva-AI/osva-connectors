import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GRAPH_DEFAULT_PAGE_SIZE,
  GRAPH_MAX_PAGE_SIZE,
  MAX_PAGINATION_PAGES,
  META_GRAPH_API_HOST,
} from "./constants.js";
import type { MetaGraphClient } from "./meta-graph-client.js";
import { parseGraphListResponse } from "./meta-graph-client.js";

export interface FetchGraphListOptions {
  readonly client: MetaGraphClient;
  readonly path: string;
  readonly fields: readonly string[];
  readonly limit: number;
  readonly after?: string;
  readonly filtering?: readonly Record<string, unknown>[];
  readonly signal?: AbortSignal;
  readonly apiHost?: string;
}

export async function fetchGraphListBounded(
  options: FetchGraphListOptions,
): Promise<{
  rows: unknown[];
  nextCursor: string | undefined;
  pagesFetched: number;
  rowsTruncated: boolean;
}> {
  const apiHost = options.apiHost ?? META_GRAPH_API_HOST;
  const targetLimit = Math.max(1, options.limit);
  const pageSize = Math.min(
    GRAPH_MAX_PAGE_SIZE,
    Math.max(
      GRAPH_DEFAULT_PAGE_SIZE,
      Math.min(targetLimit, GRAPH_MAX_PAGE_SIZE),
    ),
  );

  const rows: unknown[] = [];
  let after = options.after;
  let pagesFetched = 0;
  let lastNextCursor: string | undefined;

  while (rows.length < targetLimit && pagesFetched < MAX_PAGINATION_PAGES) {
    pagesFetched += 1;
    const raw = await options.client.listEdge({
      path: options.path,
      fields: options.fields,
      limit: Math.min(pageSize, targetLimit - rows.length),
      ...(after !== undefined ? { after } : {}),
      ...(options.filtering !== undefined
        ? { filtering: options.filtering }
        : {}),
      signal: options.signal,
    });
    const parsed = parseGraphListResponse(raw, apiHost);
    rows.push(...parsed.data);
    lastNextCursor = parsed.nextCursor;
    if (rows.length >= targetLimit) {
      break;
    }
    if (parsed.nextCursor === undefined) {
      lastNextCursor = undefined;
      break;
    }
    after = parsed.nextCursor;
  }

  const bounded = rows.slice(0, targetLimit);
  if (bounded.length === 0 && rows.length > 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads list response could not be normalized within output limits.",
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
