import { assertSelectOnly } from "./query-builder.js";

export function buildSchemaListQuery(
  database: string,
  limit: number,
  offset: number,
): { sqlText: string; binds: readonly (string | number | boolean | null)[] } {
  const sql = `SELECT SCHEMA_NAME AS "SCHEMA_NAME"
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE CATALOG_NAME = ?
ORDER BY SCHEMA_NAME
LIMIT ? OFFSET ?`;
  assertSelectOnly(sql);
  return { sqlText: sql, binds: [database, limit, offset] };
}

export function buildSchemaGetSql(
  database: string,
  schema: string,
): {
  sqlText: string;
  binds: readonly (string | number | boolean | null)[];
} {
  const sql = `SELECT SCHEMA_NAME AS "SCHEMA_NAME", SCHEMA_OWNER AS "SCHEMA_OWNER"
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE CATALOG_NAME = ? AND SCHEMA_NAME = ?
LIMIT 1`;
  assertSelectOnly(sql);
  return { sqlText: sql, binds: [database, schema] };
}

export function buildTableListSql(
  database: string,
  schema: string,
  limit: number,
  offset: number,
): { sqlText: string; binds: readonly (string | number | boolean | null)[] } {
  const sql = `SELECT TABLE_NAME AS "TABLE_NAME", TABLE_TYPE AS "TABLE_TYPE"
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_CATALOG = ? AND TABLE_SCHEMA = ?
ORDER BY TABLE_NAME
LIMIT ? OFFSET ?`;
  assertSelectOnly(sql);
  return {
    sqlText: sql,
    binds: [database, schema, limit, offset],
  };
}

export function buildTableGetSql(
  database: string,
  schema: string,
  table: string,
): { sqlText: string; binds: readonly (string | number | boolean | null)[] } {
  const sql = `SELECT TABLE_NAME AS "TABLE_NAME", TABLE_TYPE AS "TABLE_TYPE", ROW_COUNT AS "ROW_COUNT", BYTES AS "BYTES"
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_CATALOG = ? AND TABLE_SCHEMA = ? AND TABLE_NAME = ?
LIMIT 1`;
  assertSelectOnly(sql);
  return { sqlText: sql, binds: [database, schema, table] };
}

export function buildColumnsListSql(
  database: string,
  schema: string,
  table: string,
  limit: number,
  offset: number,
): { sqlText: string; binds: readonly (string | number | boolean | null)[] } {
  const sql = `SELECT COLUMN_NAME AS "COLUMN_NAME", DATA_TYPE AS "DATA_TYPE", IS_NULLABLE AS "IS_NULLABLE", ORDINAL_POSITION AS "ORDINAL_POSITION"
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_CATALOG = ? AND TABLE_SCHEMA = ? AND TABLE_NAME = ?
ORDER BY ORDINAL_POSITION
LIMIT ? OFFSET ?`;
  assertSelectOnly(sql);
  return {
    sqlText: sql,
    binds: [database, schema, table, limit, offset],
  };
}
