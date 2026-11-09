import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  columnNameSchema,
  schemaNameSchema,
  tableNameSchema,
} from "./identifier.js";

export interface TableScope {
  readonly columns: readonly string[];
  readonly lookupColumn?: string;
}

export type SchemaTableScopeMap = Readonly<
  Record<string, Readonly<Record<string, TableScope>>>
>;

function parseTableScopeEntry(
  raw: unknown,
  schema: string,
  table: string,
): TableScope {
  if (Array.isArray(raw)) {
    const columns: string[] = [];
    for (const entry of raw) {
      if (typeof entry !== "string") {
        throw new ConnectorSdkError(
          "CONFIGURATION_ERROR",
          `ALLOWED_TABLES ${schema}.${table} columns must be strings.`,
        );
      }
      const parsed = columnNameSchema.safeParse(entry);
      if (!parsed.success) {
        throw new ConnectorSdkError(
          "CONFIGURATION_ERROR",
          `ALLOWED_TABLES contains an invalid column name.`,
        );
      }
      if (!columns.includes(parsed.data)) {
        columns.push(parsed.data);
      }
    }
    if (columns.length === 0) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_TABLES ${schema}.${table} must list at least one column.`,
      );
    }
    return { columns };
  }
  if (typeof raw !== "object" || raw === null) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `ALLOWED_TABLES ${schema}.${table} must be a column array or object.`,
    );
  }
  const obj = raw as {
    columns?: unknown;
    lookupColumn?: unknown;
  };
  if (!Array.isArray(obj.columns)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `ALLOWED_TABLES ${schema}.${table} must include a columns array.`,
    );
  }
  const columns: string[] = [];
  for (const entry of obj.columns) {
    if (typeof entry !== "string") {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_TABLES columns must be strings.`,
      );
    }
    const parsed = columnNameSchema.safeParse(entry);
    if (!parsed.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_TABLES contains an invalid column name.`,
      );
    }
    if (!columns.includes(parsed.data)) {
      columns.push(parsed.data);
    }
  }
  if (columns.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `ALLOWED_TABLES ${schema}.${table} must list at least one column.`,
    );
  }
  let lookupColumn: string | undefined;
  if (obj.lookupColumn !== undefined) {
    if (typeof obj.lookupColumn !== "string") {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_TABLES lookupColumn must be a string.`,
      );
    }
    const parsedLookup = columnNameSchema.safeParse(obj.lookupColumn);
    if (!parsedLookup.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_TABLES lookupColumn is not valid.`,
      );
    }
    if (!columns.includes(parsedLookup.data)) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_TABLES lookupColumn must be listed in columns.`,
      );
    }
    lookupColumn = parsedLookup.data;
  }
  return {
    columns,
    ...(lookupColumn !== undefined ? { lookupColumn } : {}),
  };
}

export function parseAllowedTablesEnv(
  raw: string | undefined,
): SchemaTableScopeMap | undefined {
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
  const out: Record<string, Record<string, TableScope>> = {};
  for (const [schemaRaw, tablesRaw] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    const schemaParsed = schemaNameSchema.safeParse(schemaRaw);
    if (!schemaParsed.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "ALLOWED_TABLES contains an invalid schema name.",
      );
    }
    if (
      typeof tablesRaw !== "object" ||
      tablesRaw === null ||
      Array.isArray(tablesRaw)
    ) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `ALLOWED_TABLES schema "${schemaRaw}" must map to table objects.`,
      );
    }
    const tableMap: Record<string, TableScope> = {};
    for (const [tableRaw, scopeRaw] of Object.entries(
      tablesRaw as Record<string, unknown>,
    )) {
      const tableParsed = tableNameSchema.safeParse(tableRaw);
      if (!tableParsed.success) {
        throw new ConnectorSdkError(
          "CONFIGURATION_ERROR",
          "ALLOWED_TABLES contains an invalid table name.",
        );
      }
      tableMap[tableParsed.data] = parseTableScopeEntry(
        scopeRaw,
        schemaParsed.data,
        tableParsed.data,
      );
    }
    out[schemaParsed.data] = tableMap;
  }
  return out;
}

export function parseAllowedSchemasEnv(
  raw: string | undefined,
): readonly string[] | undefined {
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
      "ALLOWED_SCHEMAS is empty.",
    );
  }
  const normalized: string[] = [];
  for (const part of parts) {
    const parsed = schemaNameSchema.safeParse(part);
    if (!parsed.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "ALLOWED_SCHEMAS contains an invalid schema name.",
      );
    }
    if (!normalized.includes(parsed.data)) {
      normalized.push(parsed.data);
    }
  }
  return normalized;
}
