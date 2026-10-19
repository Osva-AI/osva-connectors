import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  QUERY_READ_DEFAULT_MAX_ROWS,
  QUERY_READ_MAX_MAX_ROWS,
  QUERY_READ_MAX_PARAMS,
  QUERY_READ_MAX_SQL_LENGTH,
} from "./query-read/constants.js";

const queryParamSchema = z.union([
  z.string().max(8_192),
  z.number().refine(Number.isFinite, "Parameter must be a finite number."),
  z.boolean(),
  z.null(),
]);

export const queryReadInputSchema = z
  .object({
    sql: z.string().min(1).max(QUERY_READ_MAX_SQL_LENGTH),
    params: z.array(queryParamSchema).max(QUERY_READ_MAX_PARAMS).optional(),
    maxRows: z
      .number()
      .int()
      .min(1)
      .max(QUERY_READ_MAX_MAX_ROWS)
      .optional()
      .default(QUERY_READ_DEFAULT_MAX_ROWS),
  })
  .strict();

export type QueryReadInput = z.infer<typeof queryReadInputSchema>;

export const queryReadInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sql"],
  properties: {
    sql: {
      type: "string",
      minLength: 1,
      maxLength: QUERY_READ_MAX_SQL_LENGTH,
      description: "Parameterized read-only SELECT query.",
    },
    params: {
      type: "array",
      maxItems: QUERY_READ_MAX_PARAMS,
      items: {
        anyOf: [
          { type: "string" },
          { type: "number" },
          { type: "boolean" },
          { type: "null" },
        ],
      },
    },
    maxRows: {
      type: "integer",
      minimum: 1,
      maximum: QUERY_READ_MAX_MAX_ROWS,
      description: "Maximum rows to return (default 100).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const queryReadOutputSchema = z.object({
  columns: z.array(
    z.object({
      name: z.string().max(128),
      dataType: z.string().max(256),
    }),
  ),
  rows: z.array(z.array(z.unknown())),
  rowCount: z.number().int().min(0),
  truncated: z.boolean(),
  maxRows: z.number().int().min(1).max(QUERY_READ_MAX_MAX_ROWS),
});

export type QueryReadOutput = z.infer<typeof queryReadOutputSchema>;
