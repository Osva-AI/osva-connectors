import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  AGGREGATE_MAX_LIMIT,
  IDENTIFIER_PATTERN,
  MAX_GROUP_BY_COLUMNS,
  PROJECT_ID_PATTERN,
  ROWS_SAMPLE_MAX_LIMIT,
} from "./constants.js";
import type { TableColumnAllowlist } from "./resource-scope.js";
import {
  assertColumnsPermitted,
  resolveAllowedColumns,
} from "./resource-scope.js";
import {
  createQueryParamBag,
  renderStructuredFilterSql,
  type StructuredFilter,
} from "./structured-filters.js";

export interface BuiltQuery {
  readonly sql: string;
  readonly params: Record<string, unknown>;
}

function quoteTable(
  projectId: string,
  datasetId: string,
  tableId: string,
): string {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid table reference.");
  }
  for (const part of [datasetId, tableId]) {
    if (!IDENTIFIER_PATTERN.test(part)) {
      throw new ConnectorSdkError("INVALID_INPUT", "Invalid table reference.");
    }
  }
  return `\`${projectId}\`.\`${datasetId}\`.\`${tableId}\``;
}

function quoteColumns(columns: readonly string[]): string {
  return columns
    .map((column) => {
      if (!IDENTIFIER_PATTERN.test(column)) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Invalid column identifier.",
        );
      }
      return `\`${column}\``;
    })
    .join(", ");
}

export function resolveSelectColumns(
  requested: readonly string[] | undefined,
  allowlist: TableColumnAllowlist | undefined,
  datasetId: string,
  tableId: string,
): readonly string[] {
  const allowed = resolveAllowedColumns(allowlist, datasetId, tableId);
  if (requested !== undefined && requested.length > 0) {
    assertColumnsPermitted(allowlist, datasetId, tableId, requested);
    return requested;
  }
  if (allowed !== undefined && allowed.length > 0) {
    return allowed;
  }
  throw new ConnectorSdkError(
    "FORBIDDEN",
    "No columns are permitted for this table.",
  );
}

export function buildSampleQuery(options: {
  readonly projectId: string;
  readonly datasetId: string;
  readonly tableId: string;
  readonly columns: readonly string[];
  readonly limit: number;
  readonly filter?: StructuredFilter;
}): BuiltQuery {
  if (options.limit < 1 || options.limit > ROWS_SAMPLE_MAX_LIMIT) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid row sample limit.");
  }
  const bag = createQueryParamBag();
  const bagLimit = bag.add(options.limit, "lim");
  let sql = `SELECT ${quoteColumns(options.columns)} FROM ${quoteTable(options.projectId, options.datasetId, options.tableId)}`;
  if (options.filter !== undefined) {
    sql += ` WHERE ${renderStructuredFilterSql(options.filter, bag)}`;
  }
  sql += ` LIMIT @${bagLimit}`;
  return { sql, params: bag.params };
}

export type AggregateFn = "count" | "sum" | "avg" | "min" | "max";

export interface AggregateMetric {
  readonly fn: AggregateFn;
  readonly column?: string;
  readonly alias?: string;
}

export function buildAggregateQuery(options: {
  readonly projectId: string;
  readonly datasetId: string;
  readonly tableId: string;
  readonly metrics: readonly AggregateMetric[];
  readonly groupBy?: readonly string[];
  readonly filter?: StructuredFilter;
  readonly limit: number;
}): BuiltQuery {
  if (
    options.groupBy !== undefined &&
    options.groupBy.length > MAX_GROUP_BY_COLUMNS
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `At most ${MAX_GROUP_BY_COLUMNS} group-by columns are allowed.`,
    );
  }
  if (options.limit < 1 || options.limit > AGGREGATE_MAX_LIMIT) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid aggregate limit.");
  }

  const bag = createQueryParamBag();
  const selects: string[] = [];
  for (const metric of options.metrics) {
    const alias =
      metric.alias !== undefined && IDENTIFIER_PATTERN.test(metric.alias)
        ? metric.alias
        : `${metric.fn}_${metric.column ?? "all"}`;
    if (metric.fn === "count") {
      const expr =
        metric.column === undefined
          ? "COUNT(*)"
          : `COUNT(\`${metric.column}\`)`;
      selects.push(`${expr} AS \`${alias}\``);
      continue;
    }
    if (
      metric.column === undefined ||
      !IDENTIFIER_PATTERN.test(metric.column)
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `${metric.fn} requires a column.`,
      );
    }
    selects.push(
      `${metric.fn.toUpperCase()}(\`${metric.column}\`) AS \`${alias}\``,
    );
  }

  if (options.groupBy !== undefined && options.groupBy.length > 0) {
    selects.unshift(...options.groupBy.map((col) => `\`${col}\``));
  }

  let sql = `SELECT ${selects.join(", ")} FROM ${quoteTable(options.projectId, options.datasetId, options.tableId)}`;
  if (options.filter !== undefined) {
    sql += ` WHERE ${renderStructuredFilterSql(options.filter, bag)}`;
  }
  if (options.groupBy !== undefined && options.groupBy.length > 0) {
    sql += ` GROUP BY ${quoteColumns(options.groupBy)}`;
  }
  const bagLimit = bag.add(options.limit, "lim");
  sql += ` LIMIT @${bagLimit}`;
  return { sql, params: bag.params };
}
