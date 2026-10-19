import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import type { FieldDef } from "pg";

import { OUTPUT_MAX_STRUCTURED_JSON_BYTES } from "../output-budget.js";
import {
  QUERY_READ_MAX_CELL_CHARS,
  QUERY_READ_MAX_COLUMNS,
} from "./constants.js";

const OID_TO_TYPE: Record<number, string> = {
  16: "boolean",
  17: "bytea",
  20: "bigint",
  21: "smallint",
  23: "integer",
  25: "text",
  700: "real",
  701: "double precision",
  1043: "character varying",
  1082: "date",
  1114: "timestamp without time zone",
  1184: "timestamp with time zone",
  1700: "numeric",
  2950: "uuid",
  3802: "jsonb",
  114: "json",
};

export interface NormalizedColumn {
  readonly name: string;
  readonly dataType: string;
}

export interface NormalizeReadQueryResult {
  readonly columns: NormalizedColumn[];
  readonly rows: unknown[][];
  readonly rowCount: number;
  readonly truncated: boolean;
}

function mapOidToDataType(field: FieldDef): string {
  const mapped = OID_TO_TYPE[field.dataTypeID];
  if (mapped !== undefined) {
    return mapped;
  }
  if (field.format === "binary") {
    return "binary";
  }
  return "unknown";
}

export function buildColumnsFromFields(fields: FieldDef[]): NormalizedColumn[] {
  if (fields.length > QUERY_READ_MAX_COLUMNS) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "PostgreSQL returned too many columns.",
    );
  }
  return fields.map((field) => {
    const name = field.name.trim();
    if (name.length === 0 || name.length > 128) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "PostgreSQL returned an invalid column name.",
      );
    }
    return {
      name,
      dataType: mapOidToDataType(field),
    };
  });
}

export function normalizeCell(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    if (value.length > QUERY_READ_MAX_CELL_CHARS) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "PostgreSQL returned a cell value that exceeds the connector limit.",
      );
    }
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "PostgreSQL returned a non-finite numeric value.",
      );
    }
    return value;
  }
  if (typeof value === "bigint") {
    const asString = value.toString();
    if (asString.length > QUERY_READ_MAX_CELL_CHARS) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "PostgreSQL returned a cell value that exceeds the connector limit.",
      );
    }
    return asString;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    const encoded = value.toString("base64");
    if (encoded.length > QUERY_READ_MAX_CELL_CHARS) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "PostgreSQL returned a cell value that exceeds the connector limit.",
      );
    }
    return { byteaBase64: encoded };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeCell(entry));
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    if (json.length > QUERY_READ_MAX_CELL_CHARS) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "PostgreSQL returned a cell value that exceeds the connector limit.",
      );
    }
    return JSON.parse(json) as unknown;
  }
  throw new ConnectorSdkError(
    "PROVIDER_ERROR",
    "PostgreSQL returned an unsupported cell value.",
  );
}

export function normalizeRawRow(
  columns: NormalizedColumn[],
  rawRow: unknown[],
): unknown[] {
  return columns.map((_, index) => normalizeCell(rawRow[index] ?? null));
}

export function structuredReadOutputBytes(options: {
  columns: NormalizedColumn[];
  rows: unknown[][];
  truncated: boolean;
}): number {
  return Buffer.byteLength(
    JSON.stringify({
      columns: options.columns,
      rows: options.rows,
      rowCount: options.rows.length,
      truncated: options.truncated,
    }),
    "utf8",
  );
}

/** @deprecated Use cursor-based fetchBoundedReadQueryResult for execution paths. */
export function normalizeReadQueryResult(options: {
  fields: FieldDef[];
  rows: unknown[][];
  maxRows: number;
}): NormalizeReadQueryResult {
  const columns = buildColumnsFromFields(options.fields);
  let truncated = false;
  let sourceRows = options.rows;
  if (sourceRows.length > options.maxRows) {
    truncated = true;
    sourceRows = sourceRows.slice(0, options.maxRows);
  }

  const rows: unknown[][] = [];
  for (const rawRow of sourceRows) {
    const normalizedRow = normalizeRawRow(columns, rawRow);
    const candidateBytes = structuredReadOutputBytes({
      columns,
      rows: [...rows, normalizedRow],
      truncated,
    });
    if (candidateBytes > OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
      if (rows.length === 0) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "PostgreSQL returned a row that exceeds the connector output budget.",
        );
      }
      truncated = true;
      break;
    }
    rows.push(normalizedRow);
  }

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated,
  };
}
