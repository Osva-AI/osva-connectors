import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { SchemaTableScopeMap, TableScope } from "./allowed-tables.js";

export function assertSchemaAllowed(
  allowedSchemas: readonly string[] | undefined,
  schema: string,
): void {
  if (allowedSchemas === undefined) {
    return;
  }
  if (!allowedSchemas.includes(schema)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Schema is not permitted by connector configuration.",
    );
  }
}

export function assertTableScopeConfigured(
  map: SchemaTableScopeMap | undefined,
): void {
  if (map === undefined) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Table access requires OSVA_CONNECTOR_SUPABASE_ALLOWED_TABLES.",
    );
  }
  if (Object.keys(map).length === 0) {
    throw new ConnectorSdkError("FORBIDDEN", "No tables are allowed.");
  }
}

export function resolveTableScope(
  map: SchemaTableScopeMap | undefined,
  schema: string,
  table: string,
): TableScope {
  assertTableScopeConfigured(map);
  const schemaMap = map?.[schema];
  if (schemaMap === undefined) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Schema is not in the allowed table map.",
    );
  }
  const scope = schemaMap[table];
  if (scope === undefined) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Table is not in the allowed table map.",
    );
  }
  return scope;
}

export function tableAllowedForDiscovery(
  map: SchemaTableScopeMap | undefined,
  schema: string,
  table: string,
): boolean {
  if (map === undefined) {
    return true;
  }
  return map[schema]?.[table] !== undefined;
}

export function listConfiguredTables(
  map: SchemaTableScopeMap | undefined,
  schema?: string,
): Array<{ schema: string; table: string; scope: TableScope }> {
  if (map === undefined) {
    return [];
  }
  const results: Array<{ schema: string; table: string; scope: TableScope }> =
    [];
  for (const [schemaName, tables] of Object.entries(map)) {
    if (schema !== undefined && schemaName !== schema) {
      continue;
    }
    for (const [tableName, scope] of Object.entries(tables)) {
      results.push({ schema: schemaName, table: tableName, scope });
    }
  }
  return results;
}

export function assertColumnsSubset(
  scope: TableScope,
  requested: readonly string[] | undefined,
): readonly string[] {
  if (requested === undefined || requested.length === 0) {
    return scope.columns;
  }
  for (const column of requested) {
    if (!scope.columns.includes(column)) {
      throw new ConnectorSdkError(
        "FORBIDDEN",
        "Requested column is not allowlisted for this table.",
      );
    }
  }
  return requested;
}
