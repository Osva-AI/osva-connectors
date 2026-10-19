import { assertSchemaAllowedByPolicy } from "../allowed-schemas.js";
import type {
  ColumnListInput,
  ColumnListOutput,
  SchemaListInput,
  SchemaListOutput,
  TableListInput,
  TableListOutput,
} from "../discovery-schemas.js";
import {
  columnListOutputSchema,
  schemaListOutputSchema,
  tableListOutputSchema,
} from "../discovery-schemas.js";
import type { PostgresDatabase } from "../postgres-client.js";
import { assertStructuredOutputWithinBudget } from "../output-budget.js";
import {
  encodeColumnCursor,
  encodeSchemaCursor,
  encodeTableCursor,
  parseColumnCursor,
  parseSchemaCursor,
  parseTableCursor,
} from "./cursor.js";
import { mapColumnRow, mapSchemaRow, mapTableRow } from "./map-rows.js";
import { COLUMN_LIST_SQL, SCHEMA_LIST_SQL, TABLE_LIST_SQL } from "./queries.js";

export interface DiscoveryRuntimeOptions {
  readonly database: PostgresDatabase;
  readonly allowedSchemas: readonly string[] | undefined;
  readonly signal?: AbortSignal;
}

function allowlistParam(
  allowedSchemas: readonly string[] | undefined,
): string[] | null {
  return allowedSchemas === undefined ? null : [...allowedSchemas];
}

function pageRows<T>(
  rows: T[],
  limit: number,
): { items: T[]; hasMore: boolean } {
  if (rows.length > limit) {
    return { items: rows.slice(0, limit), hasMore: true };
  }
  return { items: rows, hasMore: false };
}

export async function runSchemaList(
  input: SchemaListInput,
  options: DiscoveryRuntimeOptions,
): Promise<SchemaListOutput> {
  const after = parseSchemaCursor(input.cursor);
  const limit = input.limit;
  const result = await options.database.query(
    SCHEMA_LIST_SQL,
    [limit + 1, after, allowlistParam(options.allowedSchemas)],
    { signal: options.signal },
  );

  const mapped = result.rows.map((row) => mapSchemaRow(row));
  const { items, hasMore } = pageRows(mapped, limit);
  const output: SchemaListOutput = {
    schemas: items,
    ...(hasMore
      ? { nextCursor: encodeSchemaCursor(items[items.length - 1]!.name) }
      : {}),
  };
  const parsed = schemaListOutputSchema.parse(output);
  assertStructuredOutputWithinBudget(parsed);
  return parsed;
}

export async function runTableList(
  input: TableListInput,
  options: DiscoveryRuntimeOptions,
): Promise<TableListOutput> {
  assertSchemaAllowedByPolicy(input.schema, options.allowedSchemas);
  const after = parseTableCursor(input.cursor, input.schema);
  const limit = input.limit;
  const result = await options.database.query(
    TABLE_LIST_SQL,
    [input.schema, limit + 1, after, allowlistParam(options.allowedSchemas)],
    { signal: options.signal },
  );

  const mapped = result.rows.map((row) => mapTableRow(row));
  const { items, hasMore } = pageRows(mapped, limit);
  const output: TableListOutput = {
    tables: items,
    ...(hasMore
      ? {
          nextCursor: encodeTableCursor(
            input.schema,
            items[items.length - 1]!.name,
          ),
        }
      : {}),
  };
  const parsed = tableListOutputSchema.parse(output);
  assertStructuredOutputWithinBudget(parsed);
  return parsed;
}

export async function runColumnList(
  input: ColumnListInput,
  options: DiscoveryRuntimeOptions,
): Promise<ColumnListOutput> {
  assertSchemaAllowedByPolicy(input.schema, options.allowedSchemas);
  const afterOrdinal = parseColumnCursor(
    input.cursor,
    input.schema,
    input.table,
  );
  const limit = input.limit;
  const result = await options.database.query(
    COLUMN_LIST_SQL,
    [input.schema, input.table, limit + 1, afterOrdinal],
    { signal: options.signal },
  );

  const mapped = result.rows.map((row) => mapColumnRow(row));
  const { items, hasMore } = pageRows(mapped, limit);
  const output: ColumnListOutput = {
    columns: items,
    ...(hasMore
      ? {
          nextCursor: encodeColumnCursor(
            input.schema,
            input.table,
            items[items.length - 1]!.ordinalPosition,
          ),
        }
      : {}),
  };
  const parsed = columnListOutputSchema.parse(output);
  assertStructuredOutputWithinBudget(parsed);
  return parsed;
}
