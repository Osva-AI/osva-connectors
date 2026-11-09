import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  IDENTIFIER_PATTERN,
  MAX_COLUMN_NAME_LENGTH,
  MAX_FILTER_DEPTH,
  MAX_IN_LIST_SIZE,
} from "./constants.js";
import {
  assertColumnsPermitted,
  type TableColumnAllowlist,
} from "./resource-scope.js";

const scalarValueSchema = z.union([
  z.string().max(4_096),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const columnSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_COLUMN_NAME_LENGTH)
  .regex(IDENTIFIER_PATTERN, "Invalid column identifier.");

type FilterNode =
  | {
      readonly op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like";
      readonly column: string;
      readonly value: z.infer<typeof scalarValueSchema>;
    }
  | {
      readonly op: "in";
      readonly column: string;
      readonly values: readonly unknown[];
    }
  | { readonly op: "isNull" | "isNotNull"; readonly column: string }
  | { readonly op: "and" | "or"; readonly filters: readonly FilterNode[] };

function buildFilterSchema(depth: number): z.ZodType<FilterNode> {
  const leaf = z.discriminatedUnion("op", [
    z
      .object({
        op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like"]),
        column: columnSchema,
        value: scalarValueSchema,
      })
      .strict(),
    z
      .object({
        op: z.literal("in"),
        column: columnSchema,
        values: z.array(scalarValueSchema).min(1).max(MAX_IN_LIST_SIZE),
      })
      .strict(),
    z
      .object({
        op: z.enum(["isNull", "isNotNull"]),
        column: columnSchema,
      })
      .strict(),
  ]);

  if (depth <= 0) {
    return leaf;
  }

  return z.union([
    leaf,
    z
      .object({
        op: z.enum(["and", "or"]),
        filters: z
          .array(z.lazy(() => buildFilterSchema(depth - 1)))
          .min(1)
          .max(16),
      })
      .strict(),
  ]);
}

export const structuredFilterSchema = buildFilterSchema(MAX_FILTER_DEPTH);
export type StructuredFilter = z.infer<typeof structuredFilterSchema>;

export interface QueryParamBag {
  readonly params: Record<string, unknown>;
  add(value: unknown, prefix: string): string;
}

export function createQueryParamBag(): QueryParamBag {
  const params: Record<string, unknown> = {};
  let counter = 0;
  return {
    params,
    add(value: unknown, prefix: string) {
      const key = `${prefix}_${counter++}`;
      params[key] = value;
      return key;
    },
  };
}

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replaceAll("`", "")}\``;
}

function assertFilterColumnsAllowed(
  filter: StructuredFilter,
  allowlist: TableColumnAllowlist | undefined,
  datasetId: string,
  tableId: string,
): void {
  const columns: string[] = [];
  const walk = (node: StructuredFilter): void => {
    if (node.op === "and" || node.op === "or") {
      for (const child of node.filters) {
        walk(child);
      }
      return;
    }
    if ("column" in node) {
      columns.push(node.column);
    }
  };
  walk(filter);
  assertColumnsPermitted(allowlist, datasetId, tableId, columns);
}

export function renderStructuredFilterSql(
  filter: StructuredFilter,
  bag: QueryParamBag,
): string {
  switch (filter.op) {
    case "and":
      return `(${filter.filters.map((child) => renderStructuredFilterSql(child, bag)).join(" AND ")})`;
    case "or":
      return `(${filter.filters.map((child) => renderStructuredFilterSql(child, bag)).join(" OR ")})`;
    case "isNull":
      return `${quoteIdentifier(filter.column)} IS NULL`;
    case "isNotNull":
      return `${quoteIdentifier(filter.column)} IS NOT NULL`;
    case "in": {
      const keys = filter.values.map((value) => {
        const key = bag.add(value, "in");
        return `@${key}`;
      });
      return `${quoteIdentifier(filter.column)} IN (${keys.join(", ")})`;
    }
    default: {
      const key = bag.add(filter.value, filter.op);
      const column = quoteIdentifier(filter.column);
      switch (filter.op) {
        case "eq":
          return filter.value === null
            ? `${column} IS NULL`
            : `${column} = @${key}`;
        case "neq":
          return filter.value === null
            ? `${column} IS NOT NULL`
            : `${column} != @${key}`;
        case "gt":
          return `${column} > @${key}`;
        case "gte":
          return `${column} >= @${key}`;
        case "lt":
          return `${column} < @${key}`;
        case "lte":
          return `${column} <= @${key}`;
        case "like":
          return `${column} LIKE @${key}`;
        default:
          throw new ConnectorSdkError("INVALID_INPUT", "Invalid filter.");
      }
    }
  }
}

export function validateFilterForTable(
  filter: StructuredFilter | undefined,
  allowlist: TableColumnAllowlist | undefined,
  datasetId: string,
  tableId: string,
): void {
  if (filter === undefined) {
    return;
  }
  assertFilterColumnsAllowed(filter, allowlist, datasetId, tableId);
}
