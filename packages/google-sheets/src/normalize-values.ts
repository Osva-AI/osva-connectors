import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_VALUE_COLUMNS,
  MAX_VALUE_ROWS,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
  structuredOutputByteLength,
} from "./output-budget.js";

interface RawValueRange {
  readonly range?: unknown;
  readonly majorDimension?: unknown;
  readonly values?: readonly (readonly unknown[])[];
}

function normalizeRow(row: unknown): string[] {
  if (!Array.isArray(row)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  if (row.length > MAX_VALUE_COLUMNS) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned more columns than the connector allows.",
    );
  }
  return row.map((cell) => {
    if (cell === null || cell === undefined) {
      return "";
    }
    if (typeof cell !== "string") {
      return String(cell);
    }
    return normalizeTruncatableProviderString(
      cell,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  });
}

function normalizeValuesMatrix(values: unknown): string[][] {
  if (values === undefined) {
    return [];
  }
  if (!Array.isArray(values)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  if (values.length > MAX_VALUE_ROWS) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned more rows than the connector allows.",
    );
  }
  return values.map((row) => normalizeRow(row));
}

export function mapValuesGetResponse(raw: unknown): {
  range: string;
  majorDimension: string;
  values: string[][];
  valuesTruncated?: true;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const body = raw as RawValueRange;
  const range = normalizeEssentialProviderString(
    body.range,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const majorDimension = normalizeEssentialProviderString(
    body.majorDimension ?? "ROWS",
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const allRows = normalizeValuesMatrix(body.values);
  const envelope = {
    range,
    majorDimension,
    untrustedContent: true as const,
  };
  const packed = packListWithinOutputBudget(envelope, "values", allRows);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapValuesBatchGetResponse(raw: unknown): {
  spreadsheetId: string;
  valueRanges: {
    range: string;
    majorDimension: string;
    values: string[][];
    valuesTruncated?: true;
  }[];
  valueRangesTruncated?: true;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const body = raw as {
    readonly spreadsheetId?: unknown;
    readonly valueRanges?: readonly RawValueRange[];
  };
  const spreadsheetId = normalizeEssentialProviderString(
    body.spreadsheetId,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const rangesRaw = Array.isArray(body.valueRanges) ? body.valueRanges : [];
  const mapped = rangesRaw.map((entry) => {
    const range = normalizeEssentialProviderString(
      entry.range,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
    const majorDimension = normalizeEssentialProviderString(
      entry.majorDimension ?? "ROWS",
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
    const allRows = normalizeValuesMatrix(entry.values);
    const packed = packListWithinOutputBudget(
      { range, majorDimension },
      "values",
      allRows,
    );
    return packed;
  });

  const envelope = { spreadsheetId, untrustedContent: true as const };
  const packedRanges = packListWithinOutputBudget(
    envelope,
    "valueRanges",
    mapped,
  );
  assertStructuredOutputWithinBudget(packedRanges);
  return packedRanges;
}

export function mapValuesWriteResponse(raw: unknown): {
  spreadsheetId: string;
  updatedRange?: string;
  updatedRows?: number;
  updatedColumns?: number;
  updatedCells?: number;
  tableRange?: string;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const body = raw as {
    readonly spreadsheetId?: unknown;
    readonly updates?: {
      readonly updatedRange?: unknown;
      readonly updatedRows?: unknown;
      readonly updatedColumns?: unknown;
      readonly updatedCells?: unknown;
    };
    readonly tableRange?: unknown;
  };
  const spreadsheetId = normalizeEssentialProviderString(
    body.spreadsheetId,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const updates = body.updates;
  const topLevel = body as {
    readonly updatedRange?: unknown;
    readonly updatedRows?: unknown;
    readonly updatedColumns?: unknown;
    readonly updatedCells?: unknown;
  };
  const updatedRangeRaw = updates?.updatedRange ?? topLevel.updatedRange;
  const updatedRange =
    updatedRangeRaw === undefined
      ? undefined
      : normalizeEssentialProviderString(
          updatedRangeRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        );
  const updatedRows =
    typeof updates?.updatedRows === "number"
      ? updates.updatedRows
      : typeof topLevel.updatedRows === "number"
        ? topLevel.updatedRows
        : undefined;
  const updatedColumns =
    typeof updates?.updatedColumns === "number"
      ? updates.updatedColumns
      : typeof topLevel.updatedColumns === "number"
        ? topLevel.updatedColumns
        : undefined;
  const updatedCells =
    typeof updates?.updatedCells === "number"
      ? updates.updatedCells
      : typeof topLevel.updatedCells === "number"
        ? topLevel.updatedCells
        : undefined;
  const tableRange =
    body.tableRange === undefined
      ? undefined
      : normalizeEssentialProviderString(
          body.tableRange,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        );
  const result = {
    spreadsheetId,
    ...(updatedRange !== undefined ? { updatedRange } : {}),
    ...(updatedRows !== undefined ? { updatedRows } : {}),
    ...(updatedColumns !== undefined ? { updatedColumns } : {}),
    ...(updatedCells !== undefined ? { updatedCells } : {}),
    ...(tableRange !== undefined ? { tableRange } : {}),
  };
  if (structuredOutputByteLength(result) > 262_144) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Normalized Google Sheets response exceeds the connector output size limit.",
    );
  }
  return result;
}

export function mapValuesBatchUpdateResponse(raw: unknown): {
  spreadsheetId: string;
  totalUpdatedRows?: number;
  totalUpdatedColumns?: number;
  totalUpdatedCells?: number;
  totalUpdatedSheets?: number;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const body = raw as {
    readonly spreadsheetId?: unknown;
    readonly totalUpdatedRows?: unknown;
    readonly totalUpdatedColumns?: unknown;
    readonly totalUpdatedCells?: unknown;
    readonly totalUpdatedSheets?: unknown;
  };
  const spreadsheetId = normalizeEssentialProviderString(
    body.spreadsheetId,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return {
    spreadsheetId,
    ...(typeof body.totalUpdatedRows === "number"
      ? { totalUpdatedRows: body.totalUpdatedRows }
      : {}),
    ...(typeof body.totalUpdatedColumns === "number"
      ? { totalUpdatedColumns: body.totalUpdatedColumns }
      : {}),
    ...(typeof body.totalUpdatedCells === "number"
      ? { totalUpdatedCells: body.totalUpdatedCells }
      : {}),
    ...(typeof body.totalUpdatedSheets === "number"
      ? { totalUpdatedSheets: body.totalUpdatedSheets }
      : {}),
  };
}
