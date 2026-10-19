import type {
  PostgresDatabase,
  PostgresQueryResult,
} from "../../src/postgres-client.js";
import { CONNECTION_TEST_SQL } from "../../src/constants.js";

export interface MockPostgresDatabaseOptions {
  readonly serverVersion?: string;
  readonly onQuery?: (sql: string) => void;
  readonly queryError?: unknown;
  readonly queryDelayMs?: number;
}

export function createMockPostgresDatabase(
  options: MockPostgresDatabaseOptions = {},
): PostgresDatabase & { endCalls: number } {
  let endCalls = 0;
  const database: PostgresDatabase & { endCalls: number } = {
    endCalls: 0,
    async query(sql, queryOptions) {
      options.onQuery?.(sql);
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
      if (sql !== CONNECTION_TEST_SQL) {
        throw new Error("Unexpected SQL in mock.");
      }
      const rows: Record<string, unknown>[] = [
        {
          server_version:
            options.serverVersion ??
            "PostgreSQL 16.2 on x86_64-pc-linux-gnu, compiled by gcc",
        },
      ];
      const result: PostgresQueryResult = { rows };
      return result;
    },
    async end() {
      endCalls += 1;
      database.endCalls = endCalls;
    },
  };
  return database;
}
