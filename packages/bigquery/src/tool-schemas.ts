import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  AGGREGATE_MAX_LIMIT,
  IDENTIFIER_PATTERN,
  LIST_MAX_PAGE_SIZE,
  MAX_CONTINUATION_TOKEN_LENGTH,
  MAX_DATASET_ID_LENGTH,
  MAX_GROUP_BY_COLUMNS,
  MAX_METRICS,
  MAX_TABLE_ID_LENGTH,
  ROWS_SAMPLE_MAX_LIMIT,
} from "./constants.js";
import { structuredFilterSchema } from "./structured-filters.js";

const datasetSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DATASET_ID_LENGTH)
  .regex(IDENTIFIER_PATTERN);
const tableSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TABLE_ID_LENGTH)
  .regex(IDENTIFIER_PATTERN);
const limitSchema = z.number().int().min(1).max(LIST_MAX_PAGE_SIZE);
const continuationSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONTINUATION_TOKEN_LENGTH);
const sampleLimitSchema = z.number().int().min(1).max(ROWS_SAMPLE_MAX_LIMIT);
const aggregateLimitSchema = z.number().int().min(1).max(AGGREGATE_MAX_LIMIT);
const columnSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(IDENTIFIER_PATTERN);

const aggregateMetricSchema = z
  .object({
    fn: z.enum(["count", "sum", "avg", "min", "max"]),
    column: columnSchema.optional(),
    alias: columnSchema.optional(),
  })
  .strict();

export const projectGetInputSchema = z.object({}).strict();

export const projectGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const datasetListInputSchema = z
  .object({
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const datasetListInputJsonSchema = {
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

export const datasetGetInputSchema = z
  .object({ datasetId: datasetSchema })
  .strict();

export const datasetGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["datasetId"],
  properties: {
    datasetId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_DATASET_ID_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const tableListInputSchema = z
  .object({
    datasetId: datasetSchema,
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const tableListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["datasetId"],
  properties: {
    datasetId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_DATASET_ID_LENGTH,
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
    datasetId: datasetSchema,
    tableId: tableSchema,
  })
  .strict();

export const tableGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["datasetId", "tableId"],
  properties: {
    datasetId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_DATASET_ID_LENGTH,
    },
    tableId: { type: "string", minLength: 1, maxLength: MAX_TABLE_ID_LENGTH },
  },
} satisfies DefineToolOptions["inputSchema"];

export const columnsListInputSchema = tableGetInputSchema;

export const columnsListInputJsonSchema = tableGetInputJsonSchema;

export const rowsSampleInputSchema = z
  .object({
    datasetId: datasetSchema,
    tableId: tableSchema,
    columns: z.array(columnSchema).min(1).max(64).optional(),
    filter: structuredFilterSchema.optional(),
    limit: sampleLimitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const rowsSampleInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["datasetId", "tableId"],
  properties: {
    datasetId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_DATASET_ID_LENGTH,
    },
    tableId: { type: "string", minLength: 1, maxLength: MAX_TABLE_ID_LENGTH },
    columns: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 128 },
      minItems: 1,
      maxItems: 64,
    },
    filter: { type: "object" },
    limit: { type: "integer", minimum: 1, maximum: ROWS_SAMPLE_MAX_LIMIT },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const aggregateInputSchema = z
  .object({
    datasetId: datasetSchema,
    tableId: tableSchema,
    metrics: z.array(aggregateMetricSchema).min(1).max(MAX_METRICS),
    groupBy: z.array(columnSchema).max(MAX_GROUP_BY_COLUMNS).optional(),
    filter: structuredFilterSchema.optional(),
    limit: aggregateLimitSchema.optional(),
  })
  .strict();

export const aggregateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["datasetId", "tableId", "metrics"],
  properties: {
    datasetId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_DATASET_ID_LENGTH,
    },
    tableId: { type: "string", minLength: 1, maxLength: MAX_TABLE_ID_LENGTH },
    metrics: {
      type: "array",
      minItems: 1,
      maxItems: MAX_METRICS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fn"],
        properties: {
          fn: {
            type: "string",
            enum: ["count", "sum", "avg", "min", "max"],
          },
          column: { type: "string", minLength: 1, maxLength: 128 },
          alias: { type: "string", minLength: 1, maxLength: 128 },
        },
      },
    },
    groupBy: {
      type: "array",
      maxItems: MAX_GROUP_BY_COLUMNS,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    filter: { type: "object" },
    limit: { type: "integer", minimum: 1, maximum: AGGREGATE_MAX_LIMIT },
  },
} satisfies DefineToolOptions["inputSchema"];
