import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";

const UNEXPECTED =
  "Google Search Console returned an unexpected search analytics payload.";

/** Documented reporting limitations surfaced on every analytics tool result. */
export const SEARCH_ANALYTICS_REPORTING_NOTES = {
  topRowsOnly:
    "Search Analytics returns top aggregated rows for the query; row counts and pagination do not imply exhaustive extraction.",
  queryAnonymization:
    "Query-level rows may omit anonymized queries; low-volume queries can be withheld.",
  ctrIsRatio:
    "CTR is a ratio in [0, 1] from Google (not a percentage unless you scale it).",
  positionIsAverage: "Position is an average rank for the dimension group.",
  dateTimeZone:
    "Date boundaries follow Google Search Console reporting time zone (property-level Pacific Time for daily data).",
  recentDataMayBeIncomplete:
    "Recent dates may be incomplete; use dataState and metadata when present.",
  noGuaranteedQueryLevelCompleteness:
    "The API does not guarantee complete query-level data for all searches.",
} as const;

export interface AnalyticsRow {
  readonly keys: string[];
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number;
  readonly position: number;
}

export interface NormalizedSearchAnalytics {
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions: string[];
  readonly rows: AnalyticsRow[];
  readonly rowsTruncatedLocally?: true;
  readonly responseAggregationType?: string;
  readonly dataState?: string;
  readonly rowLimit: number;
  readonly startRow: number;
  readonly rowsReturned: number;
  readonly hasMoreRows?: true;
  readonly potentiallyIncompleteData?: true;
  readonly reportingNotes: typeof SEARCH_ANALYTICS_REPORTING_NOTES;
}

export interface NormalizedPageRow {
  readonly page: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number;
  readonly position: number;
}

export interface NormalizedQueryRow {
  readonly query: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number;
  readonly position: number;
}

export interface NormalizedPerformancePreset {
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly rows: NormalizedPageRow[] | NormalizedQueryRow[];
  readonly rowsTruncatedLocally?: true;
  readonly rowLimit: number;
  readonly startRow: number;
  readonly rowsReturned: number;
  readonly hasMoreRows?: true;
  readonly potentiallyIncompleteData?: true;
  readonly reportingNotes: typeof SEARCH_ANALYTICS_REPORTING_NOTES;
}

function readMetricNumber(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  throw new ConnectorSdkError(
    "PROVIDER_ERROR",
    `Google Search Console analytics row missing ${field}.`,
  );
}

function mapKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const keys: string[] = [];
  for (const entry of value) {
    keys.push(
      normalizeTruncatableProviderString(
        typeof entry === "string" ? entry : String(entry),
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value,
    );
  }
  return keys;
}

function mapAnalyticsRow(entry: unknown): AnalyticsRow {
  if (entry === null || typeof entry !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const record = entry as {
    keys?: unknown;
    clicks?: unknown;
    impressions?: unknown;
    ctr?: unknown;
    position?: unknown;
  };
  return {
    keys: mapKeys(record.keys ?? []),
    clicks: readMetricNumber(record.clicks, "clicks"),
    impressions: readMetricNumber(record.impressions, "impressions"),
    ctr: readMetricNumber(record.ctr, "ctr"),
    position: readMetricNumber(record.position, "position"),
  };
}

export function mapSearchAnalyticsResponse(options: {
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions: readonly string[];
  readonly rowLimit: number;
  readonly startRow: number;
  readonly dataState?: string;
  readonly raw: unknown;
}): NormalizedSearchAnalytics {
  if (options.raw === null || typeof options.raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const record = options.raw as {
    rows?: unknown;
    responseAggregationType?: unknown;
    metadata?: unknown;
  };

  const rawRows = Array.isArray(record.rows) ? record.rows : [];
  const mappedRows = rawRows.map((row) => mapAnalyticsRow(row));

  const envelope: Omit<
    NormalizedSearchAnalytics,
    "rows" | "rowsReturned" | "hasMoreRows"
  > = {
    siteUrl: options.siteUrl,
    startDate: options.startDate,
    endDate: options.endDate,
    dimensions: [...options.dimensions],
    rowLimit: options.rowLimit,
    startRow: options.startRow,
    reportingNotes: SEARCH_ANALYTICS_REPORTING_NOTES,
    ...(options.dataState !== undefined
      ? { dataState: options.dataState }
      : {}),
    ...(typeof record.responseAggregationType === "string"
      ? {
          responseAggregationType: normalizeEssentialProviderString(
            record.responseAggregationType,
            OUTPUT_MAX_PROVIDER_STRING_LENGTH,
            UNEXPECTED,
          ),
        }
      : {}),
    ...(options.dataState !== undefined && options.dataState !== "final"
      ? { potentiallyIncompleteData: true as const }
      : {}),
  };

  const packed = packListWithinOutputBudget(
    { ...envelope, rows: [] as AnalyticsRow[], rowsReturned: 0 },
    "rows",
    mappedRows,
  );

  const rowsReturned = packed.rows.length;
  const hasMoreRows =
    rowsReturned === options.rowLimit && rawRows.length >= options.rowLimit
      ? (true as const)
      : undefined;

  const result: NormalizedSearchAnalytics = {
    ...packed,
    rowsReturned,
    ...(hasMoreRows ? { hasMoreRows } : {}),
  };

  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapPerformancePagesResponse(options: {
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly rowLimit: number;
  readonly startRow: number;
  readonly dataState?: string;
  readonly raw: unknown;
}): NormalizedPerformancePreset {
  const analytics = mapSearchAnalyticsResponse({
    siteUrl: options.siteUrl,
    startDate: options.startDate,
    endDate: options.endDate,
    dimensions: ["page"],
    rowLimit: options.rowLimit,
    startRow: options.startRow,
    ...(options.dataState !== undefined
      ? { dataState: options.dataState }
      : {}),
    raw: options.raw,
  });

  const rows: NormalizedPageRow[] = analytics.rows.map((row) => ({
    page: row.keys[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  const result: NormalizedPerformancePreset = {
    siteUrl: analytics.siteUrl,
    startDate: analytics.startDate,
    endDate: analytics.endDate,
    rows,
    rowLimit: analytics.rowLimit,
    startRow: analytics.startRow,
    rowsReturned: rows.length,
    reportingNotes: SEARCH_ANALYTICS_REPORTING_NOTES,
    ...(analytics.rowsTruncatedLocally
      ? { rowsTruncatedLocally: true as const }
      : {}),
    ...(analytics.hasMoreRows ? { hasMoreRows: true as const } : {}),
    ...(analytics.potentiallyIncompleteData
      ? { potentiallyIncompleteData: true as const }
      : {}),
  };

  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapPerformanceQueriesResponse(options: {
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly rowLimit: number;
  readonly startRow: number;
  readonly dataState?: string;
  readonly raw: unknown;
}): NormalizedPerformancePreset {
  const analytics = mapSearchAnalyticsResponse({
    siteUrl: options.siteUrl,
    startDate: options.startDate,
    endDate: options.endDate,
    dimensions: ["query"],
    rowLimit: options.rowLimit,
    startRow: options.startRow,
    ...(options.dataState !== undefined
      ? { dataState: options.dataState }
      : {}),
    raw: options.raw,
  });

  const rows: NormalizedQueryRow[] = analytics.rows.map((row) => ({
    query: row.keys[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  const result: NormalizedPerformancePreset = {
    siteUrl: analytics.siteUrl,
    startDate: analytics.startDate,
    endDate: analytics.endDate,
    rows,
    rowLimit: analytics.rowLimit,
    startRow: analytics.startRow,
    rowsReturned: rows.length,
    reportingNotes: SEARCH_ANALYTICS_REPORTING_NOTES,
    ...(analytics.rowsTruncatedLocally
      ? { rowsTruncatedLocally: true as const }
      : {}),
    ...(analytics.hasMoreRows ? { hasMoreRows: true as const } : {}),
    ...(analytics.potentiallyIncompleteData
      ? { potentiallyIncompleteData: true as const }
      : {}),
  };

  assertStructuredOutputWithinBudget(result);
  return result;
}
