import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  AGGREGATE_MAX_LIMIT,
  MAX_GROUP_BY_COLUMNS,
  ROWS_SAMPLE_MAX_LIMIT,
} from "./constants.js";
import {
  assertBigQueryIdentifier,
  quoteBigQueryColumns,
  quoteBigQueryIdentifier,
  quoteBigQueryTable,
} from "./identifier.js";
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
  let sql = `SELECT ${quoteBigQueryColumns(options.columns)} FROM ${quoteBigQueryTable(options.projectId, options.datasetId, options.tableId)}`;
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

function aggregateFallbackAlias(fn: AggregateFn, column?: string): string {
  if (column === undefined) {
    return `${fn}_all`;
  }
  return `${fn}_${assertBigQueryIdentifier(column, "column")}`;
}

function quoteAggregateMetric(metric: AggregateMetric): string {
  const aliasSource =
    metric.alias !== undefined
      ? metric.alias
      : aggregateFallbackAlias(metric.fn, metric.column);
  const alias = quoteBigQueryIdentifier(aliasSource, "alias");

  if (metric.fn === "count") {
    if (metric.column === undefined) {
      return `COUNT(*) AS ${alias}`;
    }
    const column = quoteBigQueryIdentifier(metric.column, "column");
    return `COUNT(${column}) AS ${alias}`;
  }

  if (metric.column === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${metric.fn} requires a column.`,
    );
  }
  const column = quoteBigQueryIdentifier(metric.column, "column");
  return `${metric.fn.toUpperCase()}(${column}) AS ${alias}`;
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
    selects.push(quoteAggregateMetric(metric));
  }

  if (options.groupBy !== undefined && options.groupBy.length > 0) {
    selects.unshift(
      ...options.groupBy.map((col) => quoteBigQueryIdentifier(col)),
    );
  }

  let sql = `SELECT ${selects.join(", ")} FROM ${quoteBigQueryTable(options.projectId, options.datasetId, options.tableId)}`;
  if (options.filter !== undefined) {
    sql += ` WHERE ${renderStructuredFilterSql(options.filter, bag)}`;
  }
  if (options.groupBy !== undefined && options.groupBy.length > 0) {
    sql += ` GROUP BY ${quoteBigQueryColumns(options.groupBy)}`;
  }
  const bagLimit = bag.add(options.limit, "lim");
  sql += ` LIMIT @${bagLimit}`;
  return { sql, params: bag.params };
}
