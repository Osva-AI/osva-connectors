import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  normalizeProviderDataType,
  normalizeProviderIdentifier,
} from "../output-budget.js";

type TableKind =
  "table" | "view" | "materialized_view" | "foreign_table" | "other";

const TABLE_KINDS = new Set<string>([
  "table",
  "view",
  "materialized_view",
  "foreign_table",
  "other",
]);

export function mapSchemaRow(row: Record<string, unknown>): { name: string } {
  return {
    name: normalizeProviderIdentifier(row["name"], "schema name"),
  };
}

export function mapTableRow(row: Record<string, unknown>): {
  schema: string;
  name: string;
  kind: TableKind;
} {
  const kindRaw = row["kind"];
  if (typeof kindRaw !== "string" || !TABLE_KINDS.has(kindRaw)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "PostgreSQL returned an unexpected table kind.",
    );
  }
  return {
    schema: normalizeProviderIdentifier(row["schema"], "schema name"),
    name: normalizeProviderIdentifier(row["name"], "table name"),
    kind: kindRaw as TableKind,
  };
}

export function mapColumnRow(row: Record<string, unknown>): {
  name: string;
  dataType: string;
  nullable: boolean;
  ordinalPosition: number;
} {
  const nullable = row["nullable"];
  const ordinal = row["ordinal_position"];
  if (typeof nullable !== "boolean") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "PostgreSQL returned an unexpected column payload.",
    );
  }
  if (
    typeof ordinal !== "number" ||
    !Number.isInteger(ordinal) ||
    ordinal < 1
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "PostgreSQL returned an unexpected column ordinal.",
    );
  }
  return {
    name: normalizeProviderIdentifier(row["name"], "column name"),
    dataType: normalizeProviderDataType(row["data_type"]),
    nullable,
    ordinalPosition: ordinal,
  };
}
