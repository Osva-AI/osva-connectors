import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { snowflakeIdentifierSchema } from "./identifier.js";

export type AllowedTablesMap = Readonly<Record<string, readonly string[]>>;
export type AllowedColumnsMap = Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
>;

const MAX_SCHEMA_ENTRIES = 200;
const MAX_TABLES_PER_SCHEMA = 500;
const MAX_COLUMNS_PER_TABLE = 500;

function parseIdentifierList(
  values: unknown[],
  label: string,
): readonly string[] {
  const out: string[] = [];
  for (const entry of values) {
    if (typeof entry !== "string") {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `${label} must contain string identifiers.`,
      );
    }
    const parsed = snowflakeIdentifierSchema.safeParse(entry);
    if (!parsed.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `${label} contains an invalid identifier.`,
      );
    }
    if (!out.includes(parsed.data)) {
      out.push(parsed.data);
    }
  }
  return out;
}

export function parseAllowedSchemasEnv(
  raw: string | undefined,
): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Snowflake allowed schema list is empty or invalid.",
    );
  }
  return [...parseIdentifierList(parts, "ALLOWED_SCHEMAS")];
}

export function parseAllowedTablesEnv(
  raw: string | undefined,
): AllowedTablesMap | undefined {
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
      "ALLOWED_TABLES must be valid JSON.",
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "ALLOWED_TABLES must be a JSON object.",
    );
  }
  const out: Record<string, string[]> = {};
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > MAX_SCHEMA_ENTRIES) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "ALLOWED_TABLES exceeds maximum schema entries.",
    );
  }
  for (const [schema, tables] of entries) {
    const schemaId = snowflakeIdentifierSchema.safeParse(schema);
    if (!schemaId.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "ALLOWED_TABLES contains an invalid schema name.",
      );
    }
    if (!Array.isArray(tables)) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_TABLES schema "${schema}" must map to a table array.`,
      );
    }
    if (tables.length > MAX_TABLES_PER_SCHEMA) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "ALLOWED_TABLES exceeds maximum tables for a schema.",
      );
    }
    out[schemaId.data] = [...parseIdentifierList(tables, "ALLOWED_TABLES")];
  }
  return out;
}

export function parseAllowedColumnsEnv(
  raw: string | undefined,
): AllowedColumnsMap | undefined {
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
      "ALLOWED_COLUMNS must be valid JSON.",
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "ALLOWED_COLUMNS must be a JSON object.",
    );
  }
  const out: Record<string, Record<string, string[]>> = {};
  const schemaEntries = Object.entries(parsed as Record<string, unknown>);
  if (schemaEntries.length > MAX_SCHEMA_ENTRIES) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "ALLOWED_COLUMNS exceeds maximum schema entries.",
    );
  }
  for (const [schema, tables] of schemaEntries) {
    const schemaId = snowflakeIdentifierSchema.safeParse(schema);
    if (!schemaId.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "ALLOWED_COLUMNS contains an invalid schema name.",
      );
    }
    if (
      typeof tables !== "object" ||
      tables === null ||
      Array.isArray(tables)
    ) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_COLUMNS schema "${schema}" must map to a table object.`,
      );
    }
    const tableMap: Record<string, string[]> = {};
    for (const [table, columns] of Object.entries(
      tables as Record<string, unknown>,
    )) {
      const tableId = snowflakeIdentifierSchema.safeParse(table);
      if (!tableId.success) {
        throw new ConnectorSdkError(
          "CONFIGURATION_ERROR",
          "ALLOWED_COLUMNS contains an invalid table name.",
        );
      }
      if (!Array.isArray(columns)) {
        throw new ConnectorSdkError(
          "CONFIGURATION_ERROR",
          `ALLOWED_COLUMNS table "${table}" must map to a column array.`,
        );
      }
      if (columns.length > MAX_COLUMNS_PER_TABLE) {
        throw new ConnectorSdkError(
          "CONFIGURATION_ERROR",
          "ALLOWED_COLUMNS exceeds maximum columns for a table.",
        );
      }
      tableMap[tableId.data] = [
        ...parseIdentifierList(columns, "ALLOWED_COLUMNS"),
      ];
    }
    out[schemaId.data] = tableMap;
  }
  return out;
}

export function assertSchemaAllowed(
  schema: string,
  allowedSchemas: readonly string[] | undefined,
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

export function assertTableAllowed(
  schema: string,
  table: string,
  allowedTables: AllowedTablesMap | undefined,
): void {
  if (allowedTables === undefined) {
    return;
  }
  if (Object.keys(allowedTables).length === 0) {
    throw new ConnectorSdkError("FORBIDDEN", "No tables are allowed.");
  }
  const tables = allowedTables[schema];
  if (tables === undefined) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Schema is not in the table allowlist.",
    );
  }
  if (tables.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "No tables are allowed in this schema.",
    );
  }
  if (!tables.includes(table)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Table is not permitted by connector configuration.",
    );
  }
}

export function resolveAllowedColumnsForTable(
  schema: string,
  table: string,
  allowedColumns: AllowedColumnsMap | undefined,
): readonly string[] | undefined {
  if (allowedColumns === undefined) {
    return undefined;
  }
  const perSchema = allowedColumns[schema];
  if (perSchema === undefined) {
    return undefined;
  }
  return perSchema[table];
}

export function assertColumnAllowed(
  schema: string,
  table: string,
  column: string,
  allowedColumns: AllowedColumnsMap | undefined,
): void {
  const allowed = resolveAllowedColumnsForTable(schema, table, allowedColumns);
  if (allowed === undefined) {
    return;
  }
  if (allowed.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "No columns are allowed for this table.",
    );
  }
  if (!allowed.includes(column)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Column is not permitted by connector configuration.",
    );
  }
}

export function assertColumnsAllowed(
  schema: string,
  table: string,
  columns: readonly string[],
  allowedColumns: AllowedColumnsMap | undefined,
): void {
  for (const column of columns) {
    assertColumnAllowed(schema, table, column, allowedColumns);
  }
}
