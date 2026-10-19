import Cursor from "pg-cursor";
import type { Pool, PoolClient, Submittable } from "pg";

import { fetchBoundedReadQueryResult } from "./fetch-bounded-read-query.js";
import type {
  ReadOnlySelectExecutionOptions,
  ReadOnlySelectExecutionResult,
} from "./types.js";

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

function assertFiniteTimeoutMs(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

async function rollbackAndRelease(client: PoolClient): Promise<void> {
  await client.query("ROLLBACK");
  client.release();
}

async function rollbackAndDestroy(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } finally {
    client.release(true);
  }
}

async function applyReadOnlyTransactionSettings(
  client: PoolClient,
  statementTimeoutMs: number,
  lockTimeoutMs: number,
): Promise<void> {
  await client.query("BEGIN READ ONLY");
  await client.query(`SET LOCAL statement_timeout = ${statementTimeoutMs}`);
  await client.query(`SET LOCAL lock_timeout = ${lockTimeoutMs}`);
}

export async function withReadOnlyTransaction<T>(
  pool: Pool,
  options: {
    readonly statementTimeoutMs: number;
    readonly lockTimeoutMs: number;
    readonly signal?: AbortSignal;
  },
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (options.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const statementTimeoutMs = assertFiniteTimeoutMs(
    options.statementTimeoutMs,
    "statement_timeout",
  );
  const lockTimeoutMs = assertFiniteTimeoutMs(
    options.lockTimeoutMs,
    "lock_timeout",
  );

  const client = await pool.connect();
  try {
    await applyReadOnlyTransactionSettings(
      client,
      statementTimeoutMs,
      lockTimeoutMs,
    );
    const result = await fn(client);
    await rollbackAndRelease(client);
    return result;
  } catch (error) {
    if (isAbortError(error)) {
      await rollbackAndDestroy(client);
      throw error;
    }
    try {
      await rollbackAndRelease(client);
    } catch {
      await rollbackAndDestroy(client);
    }
    throw error;
  }
}

export async function executeReadOnlySelect(
  pool: Pool,
  options: ReadOnlySelectExecutionOptions,
): Promise<ReadOnlySelectExecutionResult> {
  if (options.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const statementTimeoutMs = assertFiniteTimeoutMs(
    options.statementTimeoutMs,
    "statement_timeout",
  );
  const lockTimeoutMs = assertFiniteTimeoutMs(
    options.lockTimeoutMs,
    "lock_timeout",
  );

  const client = await pool.connect();
  let cursor: Cursor | undefined;
  try {
    await applyReadOnlyTransactionSettings(
      client,
      statementTimeoutMs,
      lockTimeoutMs,
    );
    const portal = new Cursor(options.sql, options.params as unknown[], {
      rowMode: "array",
    });
    client.query(portal as unknown as Submittable);
    cursor = portal;
    const result = await fetchBoundedReadQueryResult({
      cursor,
      maxRows: options.maxRows,
    });
    try {
      await cursor.close();
      cursor = undefined;
    } catch {
      await rollbackAndDestroy(client);
      throw new Error("Failed to close PostgreSQL cursor.");
    }
    await rollbackAndRelease(client);
    return result;
  } catch (error) {
    if (cursor !== undefined) {
      try {
        await cursor.close();
      } catch {
        await rollbackAndDestroy(client);
        throw error;
      }
    }
    if (isAbortError(error)) {
      await rollbackAndDestroy(client);
      throw error;
    }
    try {
      await rollbackAndRelease(client);
    } catch {
      await rollbackAndDestroy(client);
    }
    throw error;
  }
}
