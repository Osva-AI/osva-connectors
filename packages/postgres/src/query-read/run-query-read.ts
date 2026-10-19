import type { QueryReadInput, QueryReadOutput } from "../query-read-schemas.js";
import { queryReadOutputSchema } from "../query-read-schemas.js";
import type { PostgresDatabase } from "../postgres-client.js";
import { assertStructuredOutputWithinBudget } from "../output-budget.js";
import { assertReadOnlySelectSql } from "./sql-admission.js";

export interface RunQueryReadOptions {
  readonly database: PostgresDatabase;
  readonly input: QueryReadInput;
  readonly signal?: AbortSignal;
  readonly statementTimeoutMs: number;
  readonly lockTimeoutMs: number;
}

export async function runQueryRead(
  options: RunQueryReadOptions,
): Promise<QueryReadOutput> {
  const params = options.input.params ?? [];
  assertReadOnlySelectSql(options.input.sql, params.length);

  const result = await options.database.runReadOnlySelect({
    sql: options.input.sql,
    params,
    maxRows: options.input.maxRows,
    statementTimeoutMs: options.statementTimeoutMs,
    lockTimeoutMs: options.lockTimeoutMs,
    signal: options.signal,
  });

  const output = queryReadOutputSchema.parse({
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rowCount,
    truncated: result.truncated,
    maxRows: options.input.maxRows,
  });
  assertStructuredOutputWithinBudget(output);
  return output;
}
