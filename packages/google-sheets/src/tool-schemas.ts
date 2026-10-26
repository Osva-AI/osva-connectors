import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import { assertValidA1Range } from "./a1-range.js";
import {
  MAX_BATCH_RANGES,
  MAX_SHEET_COLUMN_DIMENSION,
  MAX_SHEET_ROW_DIMENSION,
  MAX_SHEET_TITLE_LENGTH,
  MAX_SPREADSHEET_ID_LENGTH,
  MAX_VALUE_COLUMNS,
  MAX_VALUE_ROWS,
  SPREADSHEET_ID_PATTERN,
  VALUE_RENDER_OPTIONS,
} from "./constants.js";
import { assertWriteValuesMatrix } from "./write-values.js";

const spreadsheetIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SPREADSHEET_ID_LENGTH)
  .regex(SPREADSHEET_ID_PATTERN, "Invalid spreadsheetId.");

const a1RangeSchema = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, ctx) => {
    try {
      assertValidA1Range(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid A1 range." });
    }
  });

const valuesMatrixSchema = z
  .array(z.array(z.string()))
  .min(1)
  .max(MAX_VALUE_ROWS)
  .superRefine((rows, ctx) => {
    try {
      assertWriteValuesMatrix(rows);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message:
          error instanceof Error ? error.message : "Invalid values matrix.",
      });
    }
  });

export const spreadsheetGetInputSchema = z
  .object({
    spreadsheetId: spreadsheetIdSchema,
  })
  .strict();

export const spreadsheetGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spreadsheetId"],
  properties: {
    spreadsheetId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const sheetListInputSchema = z
  .object({
    spreadsheetId: spreadsheetIdSchema,
  })
  .strict();

export const sheetListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spreadsheetId"],
  properties: {
    spreadsheetId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

const valueRenderOptionSchema = z.enum(VALUE_RENDER_OPTIONS);

export const valuesGetInputSchema = z
  .object({
    spreadsheetId: spreadsheetIdSchema,
    range: a1RangeSchema,
    valueRenderOption: valueRenderOptionSchema.optional(),
  })
  .strict();

export const valuesGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spreadsheetId", "range"],
  properties: {
    spreadsheetId: { type: "string" },
    range: { type: "string" },
    valueRenderOption: {
      type: "string",
      enum: [...VALUE_RENDER_OPTIONS],
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const valuesBatchGetInputSchema = z
  .object({
    spreadsheetId: spreadsheetIdSchema,
    ranges: z.array(a1RangeSchema).min(1).max(MAX_BATCH_RANGES),
    valueRenderOption: valueRenderOptionSchema.optional(),
  })
  .strict();

export const valuesBatchGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spreadsheetId", "ranges"],
  properties: {
    spreadsheetId: { type: "string" },
    ranges: {
      type: "array",
      minItems: 1,
      maxItems: MAX_BATCH_RANGES,
      items: { type: "string" },
    },
    valueRenderOption: {
      type: "string",
      enum: [...VALUE_RENDER_OPTIONS],
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const valuesAppendInputSchema = z
  .object({
    spreadsheetId: spreadsheetIdSchema,
    range: a1RangeSchema,
    values: valuesMatrixSchema,
  })
  .strict();

export const valuesAppendInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spreadsheetId", "range", "values"],
  properties: {
    spreadsheetId: { type: "string" },
    range: { type: "string" },
    values: {
      type: "array",
      items: {
        type: "array",
        items: { type: "string" },
        maxItems: MAX_VALUE_COLUMNS,
      },
      maxItems: MAX_VALUE_ROWS,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const valuesUpdateInputSchema = z
  .object({
    spreadsheetId: spreadsheetIdSchema,
    range: a1RangeSchema,
    values: valuesMatrixSchema,
  })
  .strict();

export const valuesUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spreadsheetId", "range", "values"],
  properties: {
    spreadsheetId: { type: "string" },
    range: { type: "string" },
    values: {
      type: "array",
      items: {
        type: "array",
        items: { type: "string" },
        maxItems: MAX_VALUE_COLUMNS,
      },
      maxItems: MAX_VALUE_ROWS,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

const batchUpdateEntrySchema = z
  .object({
    range: a1RangeSchema,
    values: valuesMatrixSchema,
  })
  .strict();

export const valuesBatchUpdateInputSchema = z
  .object({
    spreadsheetId: spreadsheetIdSchema,
    data: z.array(batchUpdateEntrySchema).min(1).max(MAX_BATCH_RANGES),
  })
  .strict();

export const valuesBatchUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spreadsheetId", "data"],
  properties: {
    spreadsheetId: { type: "string" },
    data: {
      type: "array",
      minItems: 1,
      maxItems: MAX_BATCH_RANGES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["range", "values"],
        properties: {
          range: { type: "string" },
          values: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" },
              maxItems: MAX_VALUE_COLUMNS,
            },
            maxItems: MAX_VALUE_ROWS,
          },
        },
      },
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const sheetAddInputSchema = z
  .object({
    spreadsheetId: spreadsheetIdSchema,
    title: z
      .string()
      .trim()
      .min(1)
      .max(MAX_SHEET_TITLE_LENGTH)
      .refine((value) => !/[\0\r\n]/.test(value), "Invalid sheet title."),
    rowCount: z.number().int().min(1).max(MAX_SHEET_ROW_DIMENSION).optional(),
    columnCount: z
      .number()
      .int()
      .min(1)
      .max(MAX_SHEET_COLUMN_DIMENSION)
      .optional(),
  })
  .strict();

export const sheetAddInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spreadsheetId", "title"],
  properties: {
    spreadsheetId: { type: "string" },
    title: { type: "string", maxLength: MAX_SHEET_TITLE_LENGTH },
    rowCount: { type: "integer", minimum: 1, maximum: MAX_SHEET_ROW_DIMENSION },
    columnCount: {
      type: "integer",
      minimum: 1,
      maximum: MAX_SHEET_COLUMN_DIMENSION,
    },
  },
} satisfies DefineToolOptions["inputSchema"];
