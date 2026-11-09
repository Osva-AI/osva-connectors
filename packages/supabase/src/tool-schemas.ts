import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_CONTINUATION_TOKEN_LENGTH,
  MAX_FILTERS_PER_REQUEST,
  MAX_FILTER_VALUE_LENGTH,
  MAX_IN_FILTER_VALUES,
  MAX_LOOKUP_VALUE_LENGTH,
} from "./constants.js";
import {
  columnNameSchema,
  schemaNameSchema,
  tableNameSchema,
} from "./identifier.js";
import { POSTGREST_FILTER_OPERATORS } from "./postgrest-filters.js";

const continuationSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONTINUATION_TOKEN_LENGTH)
  .optional();

const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(LIST_MAX_PAGE_SIZE)
  .optional()
  .default(LIST_DEFAULT_PAGE_SIZE);

const filterSchema = z
  .object({
    column: columnNameSchema,
    operator: z.enum(POSTGREST_FILTER_OPERATORS),
    value: z.string().trim().min(1).max(MAX_FILTER_VALUE_LENGTH).optional(),
    values: z
      .array(z.string().trim().min(1).max(MAX_FILTER_VALUE_LENGTH))
      .min(1)
      .max(MAX_IN_FILTER_VALUES)
      .optional(),
  })
  .strict();

const orderSchema = z
  .object({
    column: columnNameSchema,
    ascending: z.boolean().optional(),
  })
  .strict();

const schemaTableBase = z
  .object({
    schema: schemaNameSchema.default("public"),
    table: tableNameSchema,
  })
  .strict();

export const projectGetInputSchema = z.object({}).strict();
export const projectGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies DefineToolOptions["inputSchema"];

export const schemaListInputSchema = z.object({}).strict();
export const schemaListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies DefineToolOptions["inputSchema"];

export const tableListInputSchema = z
  .object({
    schema: schemaNameSchema.optional(),
  })
  .strict();

export const tableListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schema: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const tableGetInputSchema = schemaTableBase;
export const tableGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["table"],
  properties: {
    schema: { type: "string", minLength: 1, maxLength: 128 },
    table: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const tableColumnsListInputSchema = schemaTableBase;
export const tableColumnsListInputJsonSchema = tableGetInputJsonSchema;

export const tableRowsListInputSchema = schemaTableBase
  .extend({
    limit: limitSchema,
    continuationToken: continuationSchema,
    columns: z.array(columnNameSchema).min(1).max(64).optional(),
    filters: z.array(filterSchema).max(MAX_FILTERS_PER_REQUEST).optional(),
    order: orderSchema.optional(),
  })
  .strict();

export const tableRowsListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["table"],
  properties: {
    schema: { type: "string", minLength: 1, maxLength: 128 },
    table: { type: "string", minLength: 1, maxLength: 128 },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
    columns: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 128 },
      minItems: 1,
      maxItems: 64,
    },
    filters: {
      type: "array",
      maxItems: MAX_FILTERS_PER_REQUEST,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["column", "operator"],
        properties: {
          column: { type: "string", minLength: 1, maxLength: 128 },
          operator: { type: "string", enum: [...POSTGREST_FILTER_OPERATORS] },
          value: {
            type: "string",
            minLength: 1,
            maxLength: MAX_FILTER_VALUE_LENGTH,
          },
          values: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
              maxLength: MAX_FILTER_VALUE_LENGTH,
            },
            minItems: 1,
            maxItems: MAX_IN_FILTER_VALUES,
          },
        },
      },
    },
    order: {
      type: "object",
      additionalProperties: false,
      required: ["column"],
      properties: {
        column: { type: "string", minLength: 1, maxLength: 128 },
        ascending: { type: "boolean" },
      },
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const tableRowGetInputSchema = schemaTableBase
  .extend({
    lookupValue: z.string().trim().min(1).max(MAX_LOOKUP_VALUE_LENGTH),
    columns: z.array(columnNameSchema).min(1).max(64).optional(),
  })
  .strict();

export const tableRowGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["table", "lookupValue"],
  properties: {
    schema: { type: "string", minLength: 1, maxLength: 128 },
    table: { type: "string", minLength: 1, maxLength: 128 },
    lookupValue: {
      type: "string",
      minLength: 1,
      maxLength: MAX_LOOKUP_VALUE_LENGTH,
    },
    columns: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 128 },
      minItems: 1,
      maxItems: 64,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const tableRowsCountInputSchema = schemaTableBase
  .extend({
    filters: z.array(filterSchema).max(MAX_FILTERS_PER_REQUEST).optional(),
    exact: z.boolean().optional(),
  })
  .strict();

export const tableRowsCountInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["table"],
  properties: {
    schema: { type: "string", minLength: 1, maxLength: 128 },
    table: { type: "string", minLength: 1, maxLength: 128 },
    exact: { type: "boolean" },
    filters: tableRowsListInputJsonSchema.properties.filters,
  },
} as const satisfies DefineToolOptions["inputSchema"];
