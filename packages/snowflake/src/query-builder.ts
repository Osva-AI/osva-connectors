import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_AGGREGATE_GROUP_BY,
  MAX_AGGREGATE_METRICS,
  MAX_FILTER_IN_VALUES,
  MAX_STRUCTURED_FILTERS,
} from "./constants.js";
import {
  quoteSnowflakeIdentifier,
  snowflakeIdentifierSchema,
  type SnowflakeIdentifier,
} from "./identifier.js";

export type StructuredFilterOp =
  "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is_null" | "is_not_null";

export interface StructuredFilter {
  readonly column: SnowflakeIdentifier;
  readonly op: StructuredFilterOp;
  readonly value?: string | number | boolean | readonly (string | number)[];
}

export type AggregateFn = "count" | "sum" | "avg" | "min" | "max";

export interface AggregateMetric {
  readonly fn: AggregateFn;
  readonly column?: SnowflakeIdentifier;
  readonly alias?: string;
}

function assertFilterValue(
  op: StructuredFilterOp,
  value: StructuredFilter["value"],
): void {
  if (op === "is_null" || op === "is_not_null") {
    if (value !== undefined) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Nullability filters must not include a value.",
      );
    }
    return;
  }
  if (value === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Filter value is required for this operator.",
    );
  }
  if (op === "in") {
    if (!Array.isArray(value)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "IN filter value must be an array.",
      );
    }
    if (value.length === 0 || value.length > MAX_FILTER_IN_VALUES) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "IN filter value list is out of bounds.",
      );
    }
  }
}

export function normalizeFilters(
  filters: readonly StructuredFilter[] | undefined,
): readonly StructuredFilter[] {
  if (filters === undefined) {
    return [];
  }
  if (filters.length > MAX_STRUCTURED_FILTERS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Too many structured filters.",
    );
  }
  for (const filter of filters) {
    const column = snowflakeIdentifierSchema.parse(filter.column);
    assertFilterValue(filter.op, filter.value);
    if (filter.op === "in" && Array.isArray(filter.value)) {
      for (const entry of filter.value) {
        if (typeof entry !== "string" && typeof entry !== "number") {
          throw new ConnectorSdkError(
            "INVALID_INPUT",
            "IN filter values must be strings or numbers.",
          );
        }
      }
    }
    if (
      filter.op !== "in" &&
      filter.value !== undefined &&
      typeof filter.value !== "string" &&
      typeof filter.value !== "number" &&
      typeof filter.value !== "boolean"
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Filter value has an unsupported type.",
      );
    }
    void column;
  }
  return filters;
}

export function normalizeAggregateMetrics(
  metrics: readonly AggregateMetric[],
): readonly AggregateMetric[] {
  if (metrics.length === 0 || metrics.length > MAX_AGGREGATE_METRICS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Aggregate metrics count is out of bounds.",
    );
  }
  for (const metric of metrics) {
    if (metric.fn === "count") {
      if (metric.column !== undefined) {
        snowflakeIdentifierSchema.parse(metric.column);
      }
      continue;
    }
    if (metric.column === undefined) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Aggregate column is required for this function.",
      );
    }
    snowflakeIdentifierSchema.parse(metric.column);
    if (metric.alias !== undefined) {
      snowflakeIdentifierSchema.parse(metric.alias);
    }
  }
  return metrics;
}

export function normalizeGroupBy(
  groupBy: readonly SnowflakeIdentifier[] | undefined,
): readonly SnowflakeIdentifier[] {
  if (groupBy === undefined) {
    return [];
  }
  if (groupBy.length > MAX_AGGREGATE_GROUP_BY) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "At most two GROUP BY columns are allowed.",
    );
  }
  return groupBy.map((col) => snowflakeIdentifierSchema.parse(col));
}

export interface BuiltSelectQuery {
  readonly sqlText: string;
  readonly binds: readonly (string | number | boolean | null)[];
}

function buildWhereClause(
  filters: readonly StructuredFilter[],
  binds: (string | number | boolean | null)[],
): string {
  const parts: string[] = [];
  for (const filter of filters) {
    const col = quoteSnowflakeIdentifier(filter.column);
    switch (filter.op) {
      case "is_null":
        parts.push(`${col} IS NULL`);
        break;
      case "is_not_null":
        parts.push(`${col} IS NOT NULL`);
        break;
      case "in": {
        const values = filter.value as readonly (string | number)[];
        const placeholders = values.map((v) => {
          binds.push(v);
          return "?";
        });
        parts.push(`${col} IN (${placeholders.join(", ")})`);
        break;
      }
      default: {
        const opMap: Record<
          Exclude<StructuredFilterOp, "in" | "is_null" | "is_not_null">,
          string
        > = {
          eq: "=",
          neq: "<>",
          gt: ">",
          gte: ">=",
          lt: "<",
          lte: "<=",
        };
        binds.push(filter.value as string | number | boolean);
        parts.push(`${col} ${opMap[filter.op]} ?`);
      }
    }
  }
  if (parts.length === 0) {
    return "";
  }
  return ` WHERE ${parts.join(" AND ")}`;
}

export function buildSampleSelectQuery(options: {
  readonly database: string;
  readonly schema: SnowflakeIdentifier;
  readonly table: SnowflakeIdentifier;
  readonly columns: readonly SnowflakeIdentifier[];
  readonly filters: readonly StructuredFilter[];
  readonly orderBy?: readonly {
    column: SnowflakeIdentifier;
    direction: "asc" | "desc";
  }[];
  readonly limit: number;
  readonly offset: number;
}): BuiltSelectQuery {
  const binds: (string | number | boolean | null)[] = [];
  const db = quoteSnowflakeIdentifier(
    snowflakeIdentifierSchema.parse(options.database),
  );
  const schema = quoteSnowflakeIdentifier(options.schema);
  const table = quoteSnowflakeIdentifier(options.table);
  const columnList = options.columns
    .map((c) => quoteSnowflakeIdentifier(c))
    .join(", ");
  let sql = `SELECT ${columnList} FROM ${db}.${schema}.${table}`;
  sql += buildWhereClause(options.filters, binds);
  if (options.orderBy !== undefined && options.orderBy.length > 0) {
    const orderParts = options.orderBy.map((entry) => {
      const col = quoteSnowflakeIdentifier(entry.column);
      const dir = entry.direction === "desc" ? "DESC" : "ASC";
      return `${col} ${dir}`;
    });
    sql += ` ORDER BY ${orderParts.join(", ")}`;
  }
  sql += " LIMIT ? OFFSET ?";
  binds.push(options.limit, options.offset);
  assertSelectOnly(sql);
  return { sqlText: sql, binds };
}

export function buildAggregateSelectQuery(options: {
  readonly database: string;
  readonly schema: SnowflakeIdentifier;
  readonly table: SnowflakeIdentifier;
  readonly metrics: readonly AggregateMetric[];
  readonly groupBy: readonly SnowflakeIdentifier[];
  readonly filters: readonly StructuredFilter[];
  readonly limit: number;
}): BuiltSelectQuery {
  const binds: (string | number | boolean | null)[] = [];
  const db = quoteSnowflakeIdentifier(
    snowflakeIdentifierSchema.parse(options.database),
  );
  const schema = quoteSnowflakeIdentifier(options.schema);
  const table = quoteSnowflakeIdentifier(options.table);

  const selectParts: string[] = [];
  for (const col of options.groupBy) {
    selectParts.push(quoteSnowflakeIdentifier(col));
  }
  for (const metric of options.metrics) {
    const fn = metric.fn.toUpperCase();
    if (metric.fn === "count" && metric.column === undefined) {
      selectParts.push(
        `COUNT(*) AS ${quoteSnowflakeIdentifier(metric.alias ?? "COUNT")}`,
      );
      continue;
    }
    const col = quoteSnowflakeIdentifier(metric.column!);
    const alias = quoteSnowflakeIdentifier(
      metric.alias ?? `${fn}_${metric.column}`,
    );
    selectParts.push(`${fn}(${col}) AS ${alias}`);
  }

  let sql = `SELECT ${selectParts.join(", ")} FROM ${db}.${schema}.${table}`;
  sql += buildWhereClause(options.filters, binds);
  if (options.groupBy.length > 0) {
    const groupCols = options.groupBy
      .map((c) => quoteSnowflakeIdentifier(c))
      .join(", ");
    sql += ` GROUP BY ${groupCols}`;
  }
  sql += " LIMIT ?";
  binds.push(options.limit);
  assertSelectOnly(sql);
  return { sqlText: sql, binds };
}

/** Ensures server-built SQL remains a single read-only SELECT. */
export function assertSelectOnly(sqlText: string): void {
  const normalized = sqlText.trim().replace(/\s+/g, " ").toUpperCase();
  if (!normalized.startsWith("SELECT ")) {
    throw new ConnectorSdkError(
      "INTERNAL",
      "Only SELECT statements are permitted.",
    );
  }
  const forbidden = [
    "INSERT ",
    "UPDATE ",
    "DELETE ",
    "MERGE ",
    "CALL ",
    "COPY ",
    "PUT ",
    "GET ",
    "CREATE ",
    "DROP ",
    "ALTER ",
    "TRUNCATE ",
    "GRANT ",
    "REVOKE ",
    ";",
  ];
  for (const token of forbidden) {
    if (normalized.includes(token)) {
      throw new ConnectorSdkError(
        "INTERNAL",
        "Only SELECT statements are permitted.",
      );
    }
  }
}
