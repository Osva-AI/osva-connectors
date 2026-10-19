import { CONNECTION_TEST_SQL } from "../../src/constants.js";
import {
  COLUMN_LIST_SQL,
  SCHEMA_LIST_SQL,
  TABLE_LIST_SQL,
} from "../../src/discovery/queries.js";
import type {
  PostgresDatabase,
  PostgresQueryResult,
  PostgresReadOnlySelectOptions,
  PostgresReadOnlySelectResult,
} from "../../src/postgres-client.js";
import {
  FIXTURE_COLUMNS,
  FIXTURE_SCHEMAS,
  FIXTURE_TABLES,
} from "./catalog-fixtures.js";

export interface MockPostgresDatabaseOptions {
  readonly serverVersion?: string;
  readonly onQuery?: (
    sql: string,
    values: readonly unknown[] | undefined,
  ) => void;
  readonly queryError?: unknown;
  readonly queryDelayMs?: number;
  readonly useCatalogFixtures?: boolean;
  readonly runReadOnlySelect?: (
    options: PostgresReadOnlySelectOptions,
  ) => Promise<PostgresReadOnlySelectResult>;
}

function filterSchemas(
  values: readonly unknown[] | undefined,
  allowedSchemas: readonly string[] | undefined,
): string[] {
  const limitPlusOne = Number(values?.[0] ?? 51);
  const after = String(values?.[1] ?? "");
  const allowlist = values?.[2] as string[] | null;
  let schemas = [...FIXTURE_SCHEMAS];
  if (allowlist !== null && Array.isArray(allowlist)) {
    schemas = schemas.filter((name) => allowlist.includes(name));
  }
  if (allowedSchemas !== undefined) {
    schemas = schemas.filter((name) => allowedSchemas.includes(name));
  }
  schemas = schemas.filter((name) => name > after).sort();
  return schemas.slice(0, limitPlusOne);
}

function filterTables(
  values: readonly unknown[] | undefined,
): Record<string, unknown>[] {
  const schema = String(values?.[0] ?? "");
  const limitPlusOne = Number(values?.[1] ?? 51);
  const after = String(values?.[2] ?? "");
  const allowlist = values?.[3] as string[] | null;
  let tables = FIXTURE_TABLES.filter((row) => row.schema === schema);
  if (allowlist !== null && Array.isArray(allowlist)) {
    tables = tables.filter((row) => allowlist.includes(row.schema));
  }
  tables = tables
    .filter((row) => row.name > after)
    .sort((a, b) => a.name.localeCompare(b.name));
  return tables.slice(0, limitPlusOne).map((row) => ({ ...row }));
}

function filterColumns(
  values: readonly unknown[] | undefined,
): Record<string, unknown>[] {
  const schema = String(values?.[0] ?? "");
  const table = String(values?.[1] ?? "");
  const limitPlusOne = Number(values?.[2] ?? 51);
  const afterOrdinal = Number(values?.[3] ?? 0);
  if (schema !== "app" || table !== "users") {
    return [];
  }
  return FIXTURE_COLUMNS.filter((col) => col.ordinal_position > afterOrdinal)
    .slice(0, limitPlusOne)
    .map((col) => ({ ...col }));
}

export function createMockPostgresDatabase(
  options: MockPostgresDatabaseOptions = {},
): PostgresDatabase & { endCalls: number } {
  let endCalls = 0;
  const database: PostgresDatabase & { endCalls: number } = {
    endCalls: 0,
    async query(sql, values, queryOptions) {
      options.onQuery?.(sql, values);
      if (queryOptions?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (options.queryError !== undefined) {
        throw options.queryError;
      }
      if (options.queryDelayMs !== undefined && options.queryDelayMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.queryDelayMs),
        );
        if (queryOptions?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
      }

      let rows: Record<string, unknown>[] = [];
      if (sql === CONNECTION_TEST_SQL) {
        rows = [
          {
            server_version:
              options.serverVersion ??
              "PostgreSQL 16.2 on x86_64-pc-linux-gnu, compiled by gcc",
          },
        ];
      } else if (options.useCatalogFixtures !== false) {
        if (sql === SCHEMA_LIST_SQL) {
          rows = filterSchemas(values, undefined).map((name) => ({ name }));
        } else if (sql === TABLE_LIST_SQL) {
          rows = filterTables(values);
        } else if (sql === COLUMN_LIST_SQL) {
          rows = filterColumns(values);
        } else {
          throw new Error(`Unexpected SQL in mock: ${sql.slice(0, 40)}`);
        }
      } else {
        throw new Error("Unexpected SQL in mock.");
      }

      const result: PostgresQueryResult = { rows };
      return result;
    },
    async runReadOnlySelect(readOptions) {
      if (options.runReadOnlySelect !== undefined) {
        return options.runReadOnlySelect(readOptions);
      }
      throw new Error("runReadOnlySelect is not configured on this mock.");
    },
    async end() {
      endCalls += 1;
      database.endCalls = endCalls;
    },
  };
  return database;
}
