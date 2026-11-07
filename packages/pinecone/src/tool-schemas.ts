import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  FETCH_MAX_IDS,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  MAX_INDEX_NAME_LENGTH,
  MAX_NAMESPACE_LENGTH,
  MAX_UPSERT_VECTORS,
  MAX_VECTOR_DIMENSION,
  MAX_VECTOR_ID_LENGTH,
  QUERY_DEFAULT_TOP_K,
  QUERY_MAX_TOP_K,
} from "./constants.js";

const indexNameSchema = z.string().trim().min(1).max(MAX_INDEX_NAME_LENGTH);
const namespaceSchema = z.string().max(MAX_NAMESPACE_LENGTH).optional();
const vectorSchema = z
  .array(z.number().finite())
  .min(1)
  .max(MAX_VECTOR_DIMENSION);

export const indexListInputSchema = z.object({}).strict();
export const indexListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const indexDescribeInputSchema = z
  .object({ indexName: indexNameSchema })
  .strict();
export const indexDescribeInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indexName"],
  properties: {
    indexName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_INDEX_NAME_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const indexStatsInputSchema = z
  .object({
    indexName: indexNameSchema,
    namespace: namespaceSchema,
  })
  .strict();
export const indexStatsInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indexName"],
  properties: {
    indexName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_INDEX_NAME_LENGTH,
    },
    namespace: { type: "string", maxLength: MAX_NAMESPACE_LENGTH },
  },
} satisfies DefineToolOptions["inputSchema"];

export const vectorQueryInputSchema = z
  .object({
    indexName: indexNameSchema,
    vector: vectorSchema,
    topK: z
      .number()
      .int()
      .min(1)
      .max(QUERY_MAX_TOP_K)
      .optional()
      .default(QUERY_DEFAULT_TOP_K),
    namespace: namespaceSchema,
    filter: z.unknown().optional(),
    includeMetadata: z.boolean().optional(),
    includeValues: z.boolean().optional(),
  })
  .strict();
export const vectorQueryInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indexName", "vector"],
  properties: {
    indexName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_INDEX_NAME_LENGTH,
    },
    vector: {
      type: "array",
      minItems: 1,
      maxItems: MAX_VECTOR_DIMENSION,
      items: { type: "number" },
    },
    topK: { type: "integer", minimum: 1, maximum: QUERY_MAX_TOP_K },
    namespace: { type: "string", maxLength: MAX_NAMESPACE_LENGTH },
    filter: {},
    includeMetadata: { type: "boolean" },
    includeValues: { type: "boolean" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const vectorFetchInputSchema = z
  .object({
    indexName: indexNameSchema,
    ids: z
      .array(z.string().trim().min(1).max(MAX_VECTOR_ID_LENGTH))
      .min(1)
      .max(FETCH_MAX_IDS),
    namespace: namespaceSchema,
  })
  .strict();
export const vectorFetchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indexName", "ids"],
  properties: {
    indexName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_INDEX_NAME_LENGTH,
    },
    ids: {
      type: "array",
      minItems: 1,
      maxItems: FETCH_MAX_IDS,
      items: { type: "string", minLength: 1, maxLength: MAX_VECTOR_ID_LENGTH },
    },
    namespace: { type: "string", maxLength: MAX_NAMESPACE_LENGTH },
  },
} satisfies DefineToolOptions["inputSchema"];

export const vectorListInputSchema = z
  .object({
    indexName: indexNameSchema,
    namespace: namespaceSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_LIMIT)
      .optional()
      .default(LIST_DEFAULT_LIMIT),
    paginationToken: z.string().trim().min(1).max(4_096).optional(),
  })
  .strict();
export const vectorListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indexName"],
  properties: {
    indexName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_INDEX_NAME_LENGTH,
    },
    namespace: { type: "string", maxLength: MAX_NAMESPACE_LENGTH },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    paginationToken: { type: "string", minLength: 1, maxLength: 4096 },
  },
} satisfies DefineToolOptions["inputSchema"];

const upsertVectorSchema = z
  .object({
    id: z.string().trim().min(1).max(MAX_VECTOR_ID_LENGTH),
    values: vectorSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const vectorUpsertInputSchema = z
  .object({
    indexName: indexNameSchema,
    namespace: namespaceSchema,
    vectors: z.array(upsertVectorSchema).min(1).max(MAX_UPSERT_VECTORS),
  })
  .strict();
export const vectorUpsertInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indexName", "vectors"],
  properties: {
    indexName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_INDEX_NAME_LENGTH,
    },
    namespace: { type: "string", maxLength: MAX_NAMESPACE_LENGTH },
    vectors: {
      type: "array",
      minItems: 1,
      maxItems: MAX_UPSERT_VECTORS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "values"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: MAX_VECTOR_ID_LENGTH },
          values: {
            type: "array",
            minItems: 1,
            maxItems: MAX_VECTOR_DIMENSION,
            items: { type: "number" },
          },
          metadata: { type: "object", additionalProperties: true },
        },
      },
    },
  },
} satisfies DefineToolOptions["inputSchema"];
