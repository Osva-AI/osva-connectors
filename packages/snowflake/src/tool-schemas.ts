import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_MAX_PAGE_SIZE,
  MAX_AGGREGATE_GROUP_BY,
  MAX_AGGREGATE_METRICS,
  MAX_CONTINUATION_TOKEN_LENGTH,
  MAX_FILTER_IN_VALUES,
  MAX_IDENTIFIER_LENGTH,
  MAX_STRUCTURED_FILTERS,
  SAMPLE_MAX_ROW_LIMIT,
} from "./constants.js";
import { snowflakeIdentifierSchema } from "./identifier.js";

const schemaNameSchema = snowflakeIdentifierSchema;
const tableNameSchema = snowflakeIdentifierSchema;
const columnNameSchema = snowflakeIdentifierSchema;
const limitSchema = z.number().int().min(1).max(LIST_MAX_PAGE_SIZE);
const sampleLimitSchema = z.number().int().min(1).max(SAMPLE_MAX_ROW_LIMIT);
const continuationSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONTINUATION_TOKEN_LENGTH);

const filterValueSchema = z.union([
  z.string().max(4096),
  z.number(),
  z.boolean(),
  z
    .array(z.union([z.string().max(1024), z.number()]))
    .min(1)
    .max(MAX_FILTER_IN_VALUES),
]);

const filterSchema = z
  .object({
    column: columnNameSchema,
    op: z.enum([
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
      "is_null",
      "is_not_null",
    ]),
    value: filterValueSchema.optional(),
  })
  .strict();

const orderBySchema = z
  .object({
    column: columnNameSchema,
    direction: z.enum(["asc", "desc"]),
  })
  .strict();

const aggregateMetricSchema = z
  .object({
    fn: z.enum(["count", "sum", "avg", "min", "max"]),
    column: columnNameSchema.optional(),
    alias: columnNameSchema.optional(),
  })
  .strict();

export const databaseGetInputSchema = z.object({}).strict();

export const databaseGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const schemaListInputSchema = z
  .object({
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const schemaListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const schemaGetInputSchema = z
  .object({ schema: schemaNameSchema })
  .strict();

export const schemaGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema"],
  properties: {
    schema: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const tableListInputSchema = z
  .object({
    schema: schemaNameSchema,
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const tableListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema"],
  properties: {
    schema: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const tableGetInputSchema = z
  .object({
    schema: schemaNameSchema,
    table: tableNameSchema,
  })
  .strict();

export const tableGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema", "table"],
  properties: {
    schema: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
    table: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const columnsListInputSchema = z
  .object({
    schema: schemaNameSchema,
    table: tableNameSchema,
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const columnsListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema", "table"],
  properties: {
    schema: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
    table: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const rowsSampleInputSchema = z
  .object({
    schema: schemaNameSchema,
    table: tableNameSchema,
    columns: z.array(columnNameSchema).min(1).max(64).optional(),
    filters: z.array(filterSchema).max(MAX_STRUCTURED_FILTERS).optional(),
    orderBy: z.array(orderBySchema).max(4).optional(),
    limit: sampleLimitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const rowsSampleInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema", "table"],
  properties: {
    schema: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
    table: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
    columns: {
      type: "array",
      minItems: 1,
      maxItems: 64,
      items: {
        type: "string",
        minLength: 1,
        maxLength: MAX_IDENTIFIER_LENGTH,
      },
    },
    filters: {
      type: "array",
      maxItems: MAX_STRUCTURED_FILTERS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["column", "op"],
        properties: {
          column: {
            type: "string",
            minLength: 1,
            maxLength: MAX_IDENTIFIER_LENGTH,
          },
          op: {
            type: "string",
            enum: [
              "eq",
              "neq",
              "gt",
              "gte",
              "lt",
              "lte",
              "in",
              "is_null",
              "is_not_null",
            ],
          },
          value: {},
        },
      },
    },
    orderBy: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["column", "direction"],
        properties: {
          column: {
            type: "string",
            minLength: 1,
            maxLength: MAX_IDENTIFIER_LENGTH,
          },
          direction: { type: "string", enum: ["asc", "desc"] },
        },
      },
    },
    limit: { type: "integer", minimum: 1, maximum: SAMPLE_MAX_ROW_LIMIT },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const tableAggregateInputSchema = z
  .object({
    schema: schemaNameSchema,
    table: tableNameSchema,
    metrics: z.array(aggregateMetricSchema).min(1).max(MAX_AGGREGATE_METRICS),
    groupBy: z.array(columnNameSchema).max(MAX_AGGREGATE_GROUP_BY).optional(),
    filters: z.array(filterSchema).max(MAX_STRUCTURED_FILTERS).optional(),
    limit: sampleLimitSchema.optional(),
  })
  .strict();

export const tableAggregateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema", "table", "metrics"],
  properties: {
    schema: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
    table: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH,
    },
    metrics: {
      type: "array",
      minItems: 1,
      maxItems: MAX_AGGREGATE_METRICS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fn"],
        properties: {
          fn: {
            type: "string",
            enum: ["count", "sum", "avg", "min", "max"],
          },
          column: {
            type: "string",
            minLength: 1,
            maxLength: MAX_IDENTIFIER_LENGTH,
          },
          alias: {
            type: "string",
            minLength: 1,
            maxLength: MAX_IDENTIFIER_LENGTH,
          },
        },
      },
    },
    groupBy: {
      type: "array",
      maxItems: MAX_AGGREGATE_GROUP_BY,
      items: {
        type: "string",
        minLength: 1,
        maxLength: MAX_IDENTIFIER_LENGTH,
      },
    },
    filters: rowsSampleInputJsonSchema.properties!.filters,
    limit: { type: "integer", minimum: 1, maximum: SAMPLE_MAX_ROW_LIMIT },
  },
} satisfies DefineToolOptions["inputSchema"];
