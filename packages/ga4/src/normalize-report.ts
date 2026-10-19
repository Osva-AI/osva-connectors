import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_HEADER_NAME_LENGTH,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";

const UNEXPECTED = "Google Analytics returned an unexpected report payload.";

export interface ReportHeader {
  readonly name: string;
}

export interface ReportRow {
  readonly dimensionValues: readonly string[];
  readonly metricValues: readonly string[];
}

export interface NormalizedReport {
  readonly propertyId: string;
  readonly dimensionHeaders: ReportHeader[];
  readonly metricHeaders: ReportHeader[];
  readonly rows: ReportRow[];
  readonly rowCount: number;
  /** Set when Google omits `rowCount` and the value is inferred from this page only (a lower bound, not the query total). */
  readonly rowCountIsLowerBound?: true;
  readonly limit: number;
  readonly offset: number;
  readonly rowsReturned: number;
  readonly hasMoreRows?: boolean;
  readonly rowsTruncatedLocally?: true;
  readonly quota?: {
    readonly tokensPerDay?: QuotaStatus;
    readonly tokensPerHour?: QuotaStatus;
    readonly concurrentRequests?: QuotaStatus;
    readonly serverErrorsPerProjectPerHour?: QuotaStatus;
    readonly potentiallyThresholdedRequestsPerHour?: QuotaStatus;
    readonly tokensPerProjectPerHour?: QuotaStatus;
  };
  readonly metadata?: {
    readonly currencyCode?: string;
    readonly timeZone?: string;
    readonly subjectToThresholding?: boolean;
  };
}

function mapHeaders(
  value: unknown,
  label: "dimension" | "metric",
): ReportHeader[] {
  if (!Array.isArray(value)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const headers: ReportHeader[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") {
      throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
    }
    const name = normalizeEssentialProviderString(
      (entry as { name?: unknown }).name,
      OUTPUT_MAX_HEADER_NAME_LENGTH,
      UNEXPECTED,
    );
    headers.push({ name });
  }
  if (headers.length === 0 && label === "metric") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  return headers;
}

function mapMetricValue(value: unknown): string {
  if (value === null || typeof value !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const record = value as { value?: unknown };
  if (typeof record.value === "string") {
    return normalizeTruncatableProviderString(
      record.value,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  }
  if (typeof record.value === "number" && Number.isFinite(record.value)) {
    return String(record.value);
  }
  return "";
}

function mapDimensionValue(value: unknown): string {
  if (value === null || typeof value !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const record = value as { value?: unknown };
  return normalizeTruncatableProviderString(
    typeof record.value === "string" ? record.value : "",
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
}

interface QuotaStatus {
  readonly consumed?: number;
  readonly remaining?: number;
}

function mapQuotaStatus(value: unknown): QuotaStatus | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const consumed =
    typeof record.consumed === "number" && Number.isFinite(record.consumed)
      ? record.consumed
      : undefined;
  const remaining =
    typeof record.remaining === "number" && Number.isFinite(record.remaining)
      ? record.remaining
      : undefined;
  if (consumed === undefined && remaining === undefined) {
    return undefined;
  }
  return {
    ...(consumed !== undefined ? { consumed } : {}),
    ...(remaining !== undefined ? { remaining } : {}),
  };
}

function parseRowCount(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return 0;
}

function mapQuota(raw: unknown): NormalizedReport["quota"] | undefined {
  if (raw === null || typeof raw !== "object") {
    return undefined;
  }
  const q = raw as Record<string, unknown>;
  const quota = {
    ...(mapQuotaStatus(q.tokensPerDay)
      ? { tokensPerDay: mapQuotaStatus(q.tokensPerDay)! }
      : {}),
    ...(mapQuotaStatus(q.tokensPerHour)
      ? { tokensPerHour: mapQuotaStatus(q.tokensPerHour)! }
      : {}),
    ...(mapQuotaStatus(q.concurrentRequests)
      ? { concurrentRequests: mapQuotaStatus(q.concurrentRequests)! }
      : {}),
    ...(mapQuotaStatus(q.serverErrorsPerProjectPerHour)
      ? {
          serverErrorsPerProjectPerHour: mapQuotaStatus(
            q.serverErrorsPerProjectPerHour,
          )!,
        }
      : {}),
    ...(mapQuotaStatus(q.potentiallyThresholdedRequestsPerHour)
      ? {
          potentiallyThresholdedRequestsPerHour: mapQuotaStatus(
            q.potentiallyThresholdedRequestsPerHour,
          )!,
        }
      : {}),
    ...(mapQuotaStatus(q.tokensPerProjectPerHour)
      ? { tokensPerProjectPerHour: mapQuotaStatus(q.tokensPerProjectPerHour)! }
      : {}),
  };
  return Object.keys(quota).length > 0 ? quota : undefined;
}

function inferHasMoreRows(params: {
  providerRowCount: boolean;
  rowCount: number;
  rowCountIsLowerBound: boolean;
  offset: number;
  rowsReturned: number;
  limit: number;
}): boolean {
  if (params.providerRowCount) {
    return (
      params.rowCount > params.offset + params.rowsReturned &&
      params.rowsReturned <= params.limit
    );
  }
  return (
    params.rowCountIsLowerBound &&
    params.rowsReturned >= params.limit &&
    params.rowsReturned > 0
  );
}

function mapMetadata(raw: unknown): NormalizedReport["metadata"] | undefined {
  if (raw === null || typeof raw !== "object") {
    return undefined;
  }
  const m = raw as Record<string, unknown>;
  const metadata = {
    ...(typeof m.currencyCode === "string"
      ? {
          currencyCode: normalizeTruncatableProviderString(m.currencyCode, 16)
            .value,
        }
      : {}),
    ...(typeof m.timeZone === "string"
      ? {
          timeZone: normalizeTruncatableProviderString(m.timeZone, 128).value,
        }
      : {}),
    ...(typeof m.subjectToThresholding === "boolean"
      ? { subjectToThresholding: m.subjectToThresholding }
      : {}),
  };
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function mapRunReportResponse(params: {
  propertyId: string;
  raw: unknown;
  limit: number;
  offset: number;
}): NormalizedReport {
  if (params.raw === null || typeof params.raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const envelope = params.raw as Record<string, unknown>;

  const dimensionHeaders = mapHeaders(envelope.dimensionHeaders, "dimension");
  const metricHeaders = mapHeaders(envelope.metricHeaders, "metric");

  const rawRows = envelope.rows;
  if (rawRows !== undefined && !Array.isArray(rawRows)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }

  const rows: ReportRow[] = [];
  if (Array.isArray(rawRows)) {
    for (const row of rawRows) {
      if (row === null || typeof row !== "object") {
        throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
      }
      const dimensionValuesRaw = (row as { dimensionValues?: unknown })
        .dimensionValues;
      const metricValuesRaw = (row as { metricValues?: unknown }).metricValues;
      if (!Array.isArray(dimensionValuesRaw)) {
        throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
      }
      if (!Array.isArray(metricValuesRaw)) {
        throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
      }
      if (dimensionValuesRaw.length !== dimensionHeaders.length) {
        throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
      }
      if (metricValuesRaw.length !== metricHeaders.length) {
        throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
      }
      rows.push({
        dimensionValues: dimensionValuesRaw.map(mapDimensionValue),
        metricValues: metricValuesRaw.map(mapMetricValue),
      });
    }
  }

  const providerRowCount = envelope.rowCount !== undefined;
  let rowCountIsLowerBound = false;
  let rowCount = parseRowCount(envelope.rowCount);
  if (!providerRowCount && rows.length > 0 && rowCount < rows.length) {
    rowCount = rows.length;
    rowCountIsLowerBound = true;
  }

  const rowsReturned = rows.length;
  const hasMoreRows = inferHasMoreRows({
    providerRowCount,
    rowCount,
    rowCountIsLowerBound,
    offset: params.offset,
    rowsReturned,
    limit: params.limit,
  });

  let result: NormalizedReport = {
    propertyId: params.propertyId,
    dimensionHeaders,
    metricHeaders,
    rows,
    rowCount,
    limit: params.limit,
    offset: params.offset,
    rowsReturned,
    ...(rowCountIsLowerBound ? { rowCountIsLowerBound: true as const } : {}),
    ...(hasMoreRows ? { hasMoreRows: true as const } : {}),
  };

  const quota = mapQuota(envelope.propertyQuota);
  if (quota !== undefined) {
    result = { ...result, quota };
  }
  const metadata = mapMetadata(envelope.metadata);
  if (metadata !== undefined) {
    result = { ...result, metadata };
  }

  const packed = packListWithinOutputBudget(result, "rows", result.rows);
  const rowsTruncatedLocally =
    "rowsTruncated" in packed && packed.rowsTruncated === true;
  const packedRowsReturned = packed.rows.length;
  const packedHasMore =
    !rowsTruncatedLocally &&
    inferHasMoreRows({
      providerRowCount,
      rowCount,
      rowCountIsLowerBound,
      offset: params.offset,
      rowsReturned: packedRowsReturned,
      limit: params.limit,
    });
  result = {
    ...packed,
    rowsReturned: packedRowsReturned,
    ...(rowsTruncatedLocally
      ? { rowsTruncatedLocally: true as const }
      : packedHasMore
        ? { hasMoreRows: true as const }
        : {}),
  };

  assertStructuredOutputWithinBudget(result);
  return result;
}
