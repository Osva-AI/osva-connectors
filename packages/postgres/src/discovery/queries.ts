/**
 * Fixed discovery SQL (audited). All user input is passed only as query parameters.
 */

export const SCHEMA_LIST_SQL = `
SELECT n.nspname AS name
FROM pg_catalog.pg_namespace n
WHERE n.nspname <> 'information_schema'
  AND n.nspname NOT LIKE 'pg_%'
  AND n.nspname NOT LIKE 'pg_toast%'
  AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
  AND ($3::text[] IS NULL OR n.nspname = ANY($3))
  AND ($2::text = '' OR n.nspname > $2)
ORDER BY n.nspname
LIMIT $1
`.trim();

export const TABLE_LIST_SQL = `
SELECT
  n.nspname AS schema,
  c.relname AS name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    WHEN 'f' THEN 'foreign_table'
    ELSE 'other'
  END AS kind
FROM pg_catalog.pg_class c
INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1
  AND n.nspname <> 'information_schema'
  AND n.nspname NOT LIKE 'pg_%'
  AND n.nspname NOT LIKE 'pg_toast%'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
  AND (
    pg_catalog.has_table_privilege(c.oid, 'SELECT')
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute col_a
      WHERE col_a.attrelid = c.oid
        AND col_a.attnum > 0
        AND NOT col_a.attisdropped
        AND pg_catalog.has_column_privilege(c.oid, col_a.attnum, 'SELECT')
    )
  )
  AND ($4::text[] IS NULL OR n.nspname = ANY($4))
  AND ($3::text = '' OR c.relname > $3)
ORDER BY c.relname
LIMIT $2
`.trim();

export const COLUMN_LIST_SQL = `
SELECT
  a.attname AS name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
  NOT a.attnotnull AS nullable,
  a.attnum AS ordinal_position
FROM pg_catalog.pg_attribute a
INNER JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1
  AND c.relname = $2
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
  AND pg_catalog.has_column_privilege(c.oid, a.attnum, 'SELECT')
  AND a.attnum > $4
ORDER BY a.attnum
LIMIT $3
`.trim();
