import {
  GRAPH_DEFAULT_PAGE_SIZE,
  GRAPH_MAX_PAGE_SIZE,
  MAX_PAGINATION_PAGES,
  META_GRAPH_API_HOST,
} from "./constants.js";
import type { AllowedBreakdown } from "./insights-allowlist.js";
import type { MetaGraphClient } from "./meta-graph-client.js";
import { parseGraphListResponse } from "./meta-graph-client.js";

export interface FetchInsightsOptions {
  readonly client: MetaGraphClient;
  readonly accountPath: string;
  readonly level: "account" | "campaign" | "adset" | "ad";
  readonly timeRange: { since: string; until: string };
  readonly limit: number;
  readonly after?: string;
  readonly breakdowns?: readonly AllowedBreakdown[];
  readonly actionAttributionWindows?: readonly string[];
  readonly useUnifiedAttributionSetting?: boolean;
  readonly signal?: AbortSignal;
  readonly apiHost?: string;
}

export async function fetchInsightsBounded(
  options: FetchInsightsOptions,
): Promise<{
  rows: unknown[];
  nextCursor: string | undefined;
  pagesFetched: number;
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
    const raw = await options.client.getInsights({
      path: options.accountPath,
      level: options.level,
      timeRange: options.timeRange,
      limit: Math.min(pageSize, targetLimit - rows.length),
      ...(after !== undefined ? { after } : {}),
      ...(options.breakdowns !== undefined
        ? { breakdowns: options.breakdowns }
        : {}),
      ...(options.actionAttributionWindows !== undefined
        ? { actionAttributionWindows: options.actionAttributionWindows }
        : {}),
      ...(options.useUnifiedAttributionSetting !== undefined
        ? {
            useUnifiedAttributionSetting: options.useUnifiedAttributionSetting,
          }
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
  const nextCursor =
    bounded.length >= targetLimit && lastNextCursor !== undefined
      ? lastNextCursor
      : undefined;

  return { rows: bounded, nextCursor, pagesFetched };
}
