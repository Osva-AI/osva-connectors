import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { IDENTIFIER_PATTERN } from "./constants.js";

export type TableColumnAllowlist = Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
>;

function assertValidIdentifier(name: string, label: string): void {
  if (name.trim().length === 0 || !IDENTIFIER_PATTERN.test(name)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} contains an invalid identifier: ${name}.`,
    );
  }
}

/**
 * Dataset allowlist parse results:
 * - env unset (`undefined`) → `undefined` (no dataset restriction on metadata)
 * - env set to empty / whitespace → `[]` (deny all datasets)
 * - env set to a CSV list → explicit allowlist
 *
 * Data-query tools require an explicit non-empty allowlist; they must not treat
 * a missing restriction as unrestricted access.
 */
export function parseAllowedDatasets(
  raw: string | undefined,
): readonly string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of parts) {
    assertValidIdentifier(id, "Allowed datasets");
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Table/column allowlist parse results:
 * - env unset (`undefined`) → `undefined` (no table restriction on metadata)
 * - env set to empty / whitespace → `{}` (deny all tables)
 * - env set to JSON → explicit dataset → table → columns[]
 *
 * An empty column array for a listed table is deny-all for those columns.
 * Data-query tools require this map to be present with non-empty columns.
 */
export function parseAllowedTables(
  raw: string | undefined,
  label: string,
): TableColumnAllowlist | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be valid JSON mapping datasets to tables and columns.`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be a JSON object.`,
    );
  }
  const out: Record<string, Record<string, string[]>> = {};
  for (const [datasetId, tables] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    assertValidIdentifier(datasetId, label);
    if (
      typeof tables !== "object" ||
      tables === null ||
      Array.isArray(tables)
    ) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `${label} dataset "${datasetId}" must map to a table object.`,
      );
    }
    const tableOut: Record<string, string[]> = {};
    for (const [tableId, columns] of Object.entries(
      tables as Record<string, unknown>,
    )) {
      assertValidIdentifier(tableId, label);
      if (!Array.isArray(columns)) {
        throw new ConnectorSdkError(
          "CONFIGURATION_ERROR",
          `${label} table "${datasetId}.${tableId}" must map to a column array.`,
        );
      }
      const normalized: string[] = [];
      for (const col of columns) {
        if (typeof col !== "string") {
          throw new ConnectorSdkError(
            "CONFIGURATION_ERROR",
            `${label} column names must be strings.`,
          );
        }
        assertValidIdentifier(col, label);
        normalized.push(col);
      }
      tableOut[tableId] = normalized;
    }
    out[datasetId] = tableOut;
  }
  return out;
}

export function assertDatasetAllowed(
  allowed: readonly string[] | undefined,
  datasetId: string,
): void {
  if (allowed === undefined) {
    return;
  }
  if (allowed.length === 0) {
    throw new ConnectorSdkError("FORBIDDEN", "No datasets are allowed.");
  }
  if (!allowed.includes(datasetId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Dataset is not in the allowed set.",
    );
  }
}

export function assertTableAllowed(
  map: TableColumnAllowlist | undefined,
  datasetId: string,
  tableId: string,
): void {
  if (map === undefined) {
    return;
  }
  if (Object.keys(map).length === 0) {
    throw new ConnectorSdkError("FORBIDDEN", "No tables are allowed.");
  }
  const tables = map[datasetId];
  if (tables === undefined || !(tableId in tables)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Table is not in the allowed set.",
    );
  }
}

export function resolveAllowedColumns(
  map: TableColumnAllowlist | undefined,
  datasetId: string,
  tableId: string,
): readonly string[] | undefined {
  if (map === undefined) {
    return undefined;
  }
  const tables = map[datasetId];
  if (tables === undefined) {
    return [];
  }
  return tables[tableId];
}

export function assertDataQueryAuthorized(
  allowedDatasets: readonly string[] | undefined,
  allowedTables: TableColumnAllowlist | undefined,
  datasetId: string,
  tableId: string,
): void {
  if (allowedDatasets === undefined) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Data queries require OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS.",
    );
  }
  assertDatasetAllowed(allowedDatasets, datasetId);
  if (allowedTables === undefined) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Data queries require OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES with explicit columns.",
    );
  }
  assertTableAllowed(allowedTables, datasetId, tableId);
}

export function assertColumnsPermitted(
  map: TableColumnAllowlist | undefined,
  datasetId: string,
  tableId: string,
  columns: readonly string[],
): void {
  if (map === undefined) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Data queries require OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES with explicit columns.",
    );
  }
  assertTableAllowed(map, datasetId, tableId);
  const allowed = resolveAllowedColumns(map, datasetId, tableId);
  if (allowed === undefined || allowed.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "No columns are permitted for this table.",
    );
  }
  const allowSet = new Set(allowed);
  for (const column of columns) {
    if (!allowSet.has(column)) {
      throw new ConnectorSdkError(
        "FORBIDDEN",
        `Column "${column}" is not allowed for this table.`,
      );
    }
  }
}

export function filterDatasetsByAllowlist(
  allowed: readonly string[] | undefined,
  datasets: readonly string[],
): string[] {
  if (allowed === undefined) {
    return [...datasets];
  }
  if (allowed.length === 0) {
    return [];
  }
  const allowSet = new Set(allowed);
  return datasets.filter((id) => allowSet.has(id));
}

export function filterTablesByAllowlist(
  map: TableColumnAllowlist | undefined,
  datasetId: string,
  tables: readonly string[],
): string[] {
  if (map === undefined) {
    return [...tables];
  }
  const scoped = map[datasetId];
  if (scoped === undefined) {
    return [];
  }
  const allowSet = new Set(Object.keys(scoped));
  return tables.filter((id) => allowSet.has(id));
}
