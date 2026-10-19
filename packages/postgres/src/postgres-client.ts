import { Pool, type PoolConfig } from "pg";

import { parsePostgresConnectionUrl } from "./parse-connection-url.js";
import { executeReadOnlySelect } from "./query-read/read-only-transaction.js";
import type { PostgresConfig } from "./schemas.js";
import { resolveNodePostgresSslOption } from "./ssl.js";

export interface PostgresQueryResult {
  readonly rows: ReadonlyArray<Record<string, unknown>>;
}

export interface PostgresReadOnlySelectOptions {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly maxRows: number;
  readonly statementTimeoutMs: number;
  readonly lockTimeoutMs: number;
  readonly totalTimeoutMs: number;
  readonly signal?: AbortSignal;
  readonly metrics?: { connectMs?: number };
}

export interface PostgresReadOnlySelectResult {
  readonly columns: ReadonlyArray<{ name: string; dataType: string }>;
  readonly rows: unknown[][];
  readonly rowCount: number;
  readonly truncated: boolean;
}

export interface PostgresDatabase {
  query(
    sql: string,
    values?: readonly unknown[],
    options?: {
      readonly signal?: AbortSignal;
    },
  ): Promise<PostgresQueryResult>;
  runReadOnlySelect(
    options: PostgresReadOnlySelectOptions,
  ): Promise<PostgresReadOnlySelectResult>;
  end(): Promise<void>;
}

export function createPostgresPoolConfig(config: PostgresConfig): PoolConfig {
  const { connectionString } = parsePostgresConnectionUrl(config.connectionUrl);
  return {
    connectionString,
    ssl: resolveNodePostgresSslOption(config.sslMode),
    max: config.poolMax,
    connectionTimeoutMillis: config.connectTimeoutMs,
    statement_timeout: config.queryTimeoutMs,
  };
}

export function createPostgresPool(config: PostgresConfig): Pool {
  return new Pool(createPostgresPoolConfig(config));
}

export function createPgDatabase(
  pool: Pool,
  config: PostgresConfig,
): PostgresDatabase {
  void config;
  return {
    async query(sql, values = [], options) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const result = await pool.query(sql, values as unknown[]);
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return { rows: result.rows as Record<string, unknown>[] };
    },
    async runReadOnlySelect(options) {
      return executeReadOnlySelect(pool, options);
    },
    async end() {
      await pool.end();
    },
  };
}
