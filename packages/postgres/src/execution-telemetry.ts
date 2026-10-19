import type { ConnectorSdkError } from "@osva-ai/connector-sdk";
import type { Pool } from "pg";

import { mapPostgresError } from "./map-postgres-error.js";
import { isAbortError, isTotalDeadlineError } from "./operation-context.js";

export type PostgresExecutionOutcome =
  "success" | "cancelled" | "timeout" | "error";

export interface PostgresExecutionEvent {
  readonly tool: string;
  readonly durationMs: number;
  readonly connectMs?: number;
  readonly rowCount?: number;
  readonly truncated?: boolean;
  readonly outcome: PostgresExecutionOutcome;
  readonly errorCategory?: string;
  readonly poolTotal?: number;
  readonly poolIdle?: number;
  readonly poolWaiting?: number;
}

export type PostgresExecutionEventSink = (
  event: PostgresExecutionEvent,
) => void;

export function readPoolStats(pool: Pool | undefined): {
  poolTotal?: number;
  poolIdle?: number;
  poolWaiting?: number;
} {
  if (pool === undefined) {
    return {};
  }
  return {
    poolTotal: pool.totalCount,
    poolIdle: pool.idleCount,
    poolWaiting: pool.waitingCount,
  };
}

function classifyOutcome(error: unknown): PostgresExecutionOutcome {
  if (isAbortError(error)) {
    return "cancelled";
  }
  if (isTotalDeadlineError(error)) {
    return "timeout";
  }
  const mapped = mapPostgresError(error);
  if (mapped.code === "TIMEOUT" || mapped.code === "CANCELLED") {
    return mapped.code === "CANCELLED" ? "cancelled" : "timeout";
  }
  return "error";
}

export async function recordToolExecution<T>(options: {
  tool: string;
  pool?: Pool;
  connectMsRef?: { connectMs?: number };
  sink?: PostgresExecutionEventSink;
  execute: () => Promise<T>;
  extractMetrics?: (result: T) => {
    rowCount?: number;
    truncated?: boolean;
  };
}): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await options.execute();
    options.sink?.({
      tool: options.tool,
      durationMs: Date.now() - startedAt,
      connectMs: options.connectMsRef?.connectMs,
      outcome: "success",
      ...readPoolStats(options.pool),
      ...options.extractMetrics?.(result),
    });
    return result;
  } catch (error) {
    const outcome = classifyOutcome(error);
    const mapped = mapPostgresError(error);
    options.sink?.({
      tool: options.tool,
      durationMs: Date.now() - startedAt,
      connectMs: options.connectMsRef?.connectMs,
      outcome,
      errorCategory: mapped.code,
      ...readPoolStats(options.pool),
    });
    throw error;
  }
}

export function errorCategory(error: unknown): string {
  return (mapPostgresError(error) as ConnectorSdkError).code;
}
