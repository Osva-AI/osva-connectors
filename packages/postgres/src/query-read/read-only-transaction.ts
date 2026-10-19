import Cursor from "pg-cursor";
import type { Pool, PoolClient, Submittable } from "pg";

import { acquirePoolClient } from "../acquire-pool-client.js";
import {
  PostgresOperationContext,
  requiresConnectionDestroy,
} from "../operation-context.js";
import { fetchBoundedReadQueryResult } from "./fetch-bounded-read-query.js";
import { finalizeReadOnlySession } from "./read-only-cleanup.js";
import type {
  ReadOnlySelectExecutionOptions,
  ReadOnlySelectExecutionResult,
} from "./types.js";

function assertFiniteTimeoutMs(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
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
    readonly totalTimeoutMs: number;
    readonly signal?: AbortSignal;
  },
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const operation = new PostgresOperationContext(
    options.totalTimeoutMs,
    options.signal,
  );
  operation.assertActive();

  const statementTimeoutMs = assertFiniteTimeoutMs(
    options.statementTimeoutMs,
    "statement_timeout",
  );
  const lockTimeoutMs = assertFiniteTimeoutMs(
    options.lockTimeoutMs,
    "lock_timeout",
  );

  const client = await acquirePoolClient(pool, operation);
  try {
    await operation.race(
      applyReadOnlyTransactionSettings(
        client,
        statementTimeoutMs,
        lockTimeoutMs,
      ),
    );
    const result = await fn(client);
    await finalizeReadOnlySession({ client, destroy: false });
    return result;
  } catch (error) {
    await finalizeReadOnlySession({
      client,
      destroy: requiresConnectionDestroy(error),
    });
    throw error;
  }
}

export async function executeReadOnlySelect(
  pool: Pool,
  options: ReadOnlySelectExecutionOptions,
): Promise<ReadOnlySelectExecutionResult> {
  const operation = new PostgresOperationContext(
    options.totalTimeoutMs,
    options.signal,
  );
  operation.assertActive();

  const statementTimeoutMs = assertFiniteTimeoutMs(
    options.statementTimeoutMs,
    "statement_timeout",
  );
  const lockTimeoutMs = assertFiniteTimeoutMs(
    options.lockTimeoutMs,
    "lock_timeout",
  );

  const connectStartedAt = Date.now();
  const client = await acquirePoolClient(pool, operation);
  if (options.metrics !== undefined) {
    options.metrics.connectMs = Date.now() - connectStartedAt;
  }

  let cursor: Cursor | undefined;
  try {
    await operation.race(
      applyReadOnlyTransactionSettings(
        client,
        statementTimeoutMs,
        lockTimeoutMs,
      ),
    );

    const portal = new Cursor(options.sql, options.params as unknown[], {
      rowMode: "array",
    });
    client.query(portal as unknown as Submittable);
    cursor = portal;

    const result = await fetchBoundedReadQueryResult({
      cursor,
      maxRows: options.maxRows,
      operation,
    });

    try {
      await operation.race(cursor.close());
      cursor = undefined;
    } catch (closeError) {
      await finalizeReadOnlySession({ client, cursor, destroy: true });
      throw closeError;
    }
    await finalizeReadOnlySession({ client, destroy: false });
    return result;
  } catch (error) {
    await finalizeReadOnlySession({
      client,
      cursor,
      destroy: requiresConnectionDestroy(error),
    });
    throw error;
  }
}
