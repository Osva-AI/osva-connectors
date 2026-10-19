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
  readonly limit: number;
  readonly offset: number;
  readonly rowsReturned: number;
  readonly hasMoreRows?: boolean;
  readonly rowsTruncatedLocally?: true;
  readonly quota?: {
    readonly tokensPerDay?: number;
    readonly tokensPerHour?: number;
    readonly concurrentRequests?: number;
    readonly serverErrorsPerProjectPerHour?: number;
    readonly potentiallyThresholded?: boolean;
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
    ...(typeof q.tokensPerDay === "number" && Number.isFinite(q.tokensPerDay)
      ? { tokensPerDay: q.tokensPerDay }
      : {}),
    ...(typeof q.tokensPerHour === "number" && Number.isFinite(q.tokensPerHour)
      ? { tokensPerHour: q.tokensPerHour }
      : {}),
    ...(typeof q.concurrentRequests === "number" &&
    Number.isFinite(q.concurrentRequests)
      ? { concurrentRequests: q.concurrentRequests }
      : {}),
    ...(typeof q.serverErrorsPerProjectPerHour === "number" &&
    Number.isFinite(q.serverErrorsPerProjectPerHour)
      ? { serverErrorsPerProjectPerHour: q.serverErrorsPerProjectPerHour }
      : {}),
    ...(typeof q.potentiallyThresholded === "boolean"
      ? { potentiallyThresholded: q.potentiallyThresholded }
      : {}),
  };
  return Object.keys(quota).length > 0 ? quota : undefined;
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

  let rowCount = parseRowCount(envelope.rowCount);
  if (
    envelope.rowCount === undefined &&
    rows.length > 0 &&
    rowCount < rows.length
  ) {
    rowCount = rows.length;
  }

  const rowsReturned = rows.length;
  const hasMoreRows =
    rowCount > params.offset + rowsReturned && rowsReturned <= params.limit;

  let result: NormalizedReport = {
    propertyId: params.propertyId,
    dimensionHeaders,
    metricHeaders,
    rows,
    rowCount,
    limit: params.limit,
    offset: params.offset,
    rowsReturned,
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
    rowCount > params.offset + packedRowsReturned &&
    packedRowsReturned <= params.limit;
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
