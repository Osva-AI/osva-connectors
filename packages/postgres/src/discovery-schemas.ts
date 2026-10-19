import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import { DISCOVERY_DEFAULT_LIMIT, DISCOVERY_MAX_LIMIT } from "./constants.js";
import {
  OUTPUT_MAX_DATA_TYPE_LENGTH,
  OUTPUT_MAX_IDENTIFIER_LENGTH,
} from "./output-budget.js";
import { postgresIdentifierSchema } from "./identifier.js";

const paginationInputFields = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(DISCOVERY_MAX_LIMIT)
    .optional()
    .default(DISCOVERY_DEFAULT_LIMIT),
  cursor: z.string().trim().min(1).max(512).optional(),
};

export const schemaListInputSchema = z.object(paginationInputFields).strict();

export type SchemaListInput = z.infer<typeof schemaListInputSchema>;

export const schemaListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: DISCOVERY_MAX_LIMIT,
      description: "Maximum schemas to return (default 50, max 100).",
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: 512,
      description: "Opaque pagination cursor from a previous response.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

const tableKindSchema = z.enum([
  "table",
  "view",
  "materialized_view",
  "foreign_table",
  "other",
]);

export const schemaRecordSchema = z.object({
  name: z.string().max(OUTPUT_MAX_IDENTIFIER_LENGTH),
});

export const schemaListOutputSchema = z.object({
  schemas: z.array(schemaRecordSchema).max(DISCOVERY_MAX_LIMIT),
  nextCursor: z.string().max(512).optional(),
  truncated: z.boolean().optional(),
});

export type SchemaListOutput = z.infer<typeof schemaListOutputSchema>;

export const tableListInputSchema = z
  .object({
    schema: postgresIdentifierSchema,
    ...paginationInputFields,
  })
  .strict();

export type TableListInput = z.infer<typeof tableListInputSchema>;

export const tableListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema"],
  properties: {
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 63,
      description: "Schema name.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: DISCOVERY_MAX_LIMIT,
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: 512,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const tableRecordSchema = z.object({
  schema: z.string().max(OUTPUT_MAX_IDENTIFIER_LENGTH),
  name: z.string().max(OUTPUT_MAX_IDENTIFIER_LENGTH),
  kind: tableKindSchema,
});

export const tableListOutputSchema = z.object({
  tables: z.array(tableRecordSchema).max(DISCOVERY_MAX_LIMIT),
  nextCursor: z.string().max(512).optional(),
});

export type TableListOutput = z.infer<typeof tableListOutputSchema>;

export const columnListInputSchema = z
  .object({
    schema: postgresIdentifierSchema,
    table: postgresIdentifierSchema,
    ...paginationInputFields,
  })
  .strict();

export type ColumnListInput = z.infer<typeof columnListInputSchema>;

export const columnListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema", "table"],
  properties: {
    schema: { type: "string", minLength: 1, maxLength: 63 },
    table: { type: "string", minLength: 1, maxLength: 63 },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: DISCOVERY_MAX_LIMIT,
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: 512,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const columnRecordSchema = z.object({
  name: z.string().max(OUTPUT_MAX_IDENTIFIER_LENGTH),
  dataType: z.string().max(OUTPUT_MAX_DATA_TYPE_LENGTH),
  nullable: z.boolean(),
  ordinalPosition: z.number().int().min(1).max(32_767),
});

export const columnListOutputSchema = z.object({
  columns: z.array(columnRecordSchema).max(DISCOVERY_MAX_LIMIT),
  nextCursor: z.string().max(512).optional(),
});

export type ColumnListOutput = z.infer<typeof columnListOutputSchema>;

export { tableKindSchema };
