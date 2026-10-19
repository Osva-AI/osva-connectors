import { Pool, type PoolConfig } from "pg";

import { parsePostgresConnectionUrl } from "./parse-connection-url.js";
import type { PostgresConfig } from "./schemas.js";
import { resolveNodePostgresSslOption } from "./ssl.js";

export interface PostgresQueryResult {
  readonly rows: ReadonlyArray<Record<string, unknown>>;
}

export interface PostgresDatabase {
  query(
    sql: string,
    values?: readonly unknown[],
    options?: {
      readonly signal?: AbortSignal;
    },
  ): Promise<PostgresQueryResult>;
  end(): Promise<void>;
}

/**
 * Pool-level PostgreSQL `statement_timeout` (milliseconds) is enforced by the
 * server and cancels long-running statements. This avoids client-only
 * Promise.race timeouts that leave queries running while pool connections stay
 * busy.
 */
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

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

export function createPgDatabase(pool: Pool): PostgresDatabase {
  return {
    async query(sql, values = [], options) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      try {
        const result = await pool.query(sql, values as unknown[]);
        if (options?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return { rows: result.rows as Record<string, unknown>[] };
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        throw error;
      }
    },
    async end() {
      await pool.end();
    },
  };
}
