import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  MAX_COLLECTION_NAME_LENGTH,
  MAX_POINT_ID_LENGTH,
  MAX_POINT_IDS,
  MAX_UPSERT_POINTS,
  MAX_VECTOR_DIMENSION,
  QUERY_DEFAULT_LIMIT,
  QUERY_MAX_LIMIT,
  SCROLL_DEFAULT_LIMIT,
  SCROLL_MAX_LIMIT,
} from "./constants.js";

const collectionNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_COLLECTION_NAME_LENGTH);

const pointIdSchema = z.union([
  z.string().trim().min(1).max(MAX_POINT_ID_LENGTH),
  z.number().finite(),
]);

const vectorSchema = z
  .array(z.number().finite())
  .min(1)
  .max(MAX_VECTOR_DIMENSION);

export const collectionGetInputSchema = z
  .object({
    collectionName: collectionNameSchema,
  })
  .strict();

export const collectionGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["collectionName"],
  properties: {
    collectionName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_COLLECTION_NAME_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const collectionListInputSchema = z.object({}).strict();

export const collectionListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const pointGetInputSchema = z
  .object({
    collectionName: collectionNameSchema,
    ids: z.array(pointIdSchema).min(1).max(MAX_POINT_IDS),
    withPayload: z.boolean().optional(),
    withVector: z.boolean().optional(),
  })
  .strict();

export const pointGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["collectionName", "ids"],
  properties: {
    collectionName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_COLLECTION_NAME_LENGTH,
    },
    ids: {
      type: "array",
      minItems: 1,
      maxItems: MAX_POINT_IDS,
      items: {
        oneOf: [
          { type: "string", minLength: 1, maxLength: MAX_POINT_ID_LENGTH },
          { type: "number" },
        ],
      },
    },
    withPayload: { type: "boolean" },
    withVector: { type: "boolean" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const pointScrollInputSchema = z
  .object({
    collectionName: collectionNameSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(SCROLL_MAX_LIMIT)
      .optional()
      .default(SCROLL_DEFAULT_LIMIT),
    offset: z.unknown().optional(),
    filter: z.unknown().optional(),
    withPayload: z.boolean().optional(),
    withVector: z.boolean().optional(),
  })
  .strict();

export const pointScrollInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["collectionName"],
  properties: {
    collectionName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_COLLECTION_NAME_LENGTH,
    },
    limit: { type: "integer", minimum: 1, maximum: SCROLL_MAX_LIMIT },
    offset: {},
    filter: {},
    withPayload: { type: "boolean" },
    withVector: { type: "boolean" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const pointQueryInputSchema = z
  .object({
    collectionName: collectionNameSchema,
    vector: vectorSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(QUERY_MAX_LIMIT)
      .optional()
      .default(QUERY_DEFAULT_LIMIT),
    filter: z.unknown().optional(),
    withPayload: z.boolean().optional(),
    withVector: z.boolean().optional(),
    scoreThreshold: z.number().finite().optional(),
  })
  .strict();

export const pointQueryInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["collectionName", "vector"],
  properties: {
    collectionName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_COLLECTION_NAME_LENGTH,
    },
    vector: {
      type: "array",
      minItems: 1,
      maxItems: MAX_VECTOR_DIMENSION,
      items: { type: "number" },
    },
    limit: { type: "integer", minimum: 1, maximum: QUERY_MAX_LIMIT },
    filter: {},
    withPayload: { type: "boolean" },
    withVector: { type: "boolean" },
    scoreThreshold: { type: "number" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const pointCountInputSchema = z
  .object({
    collectionName: collectionNameSchema,
    filter: z.unknown().optional(),
    exact: z.boolean().optional(),
  })
  .strict();

export const pointCountInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["collectionName"],
  properties: {
    collectionName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_COLLECTION_NAME_LENGTH,
    },
    filter: {},
    exact: { type: "boolean" },
  },
} satisfies DefineToolOptions["inputSchema"];

const upsertPointSchema = z
  .object({
    id: pointIdSchema,
    vector: vectorSchema,
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const pointUpsertInputSchema = z
  .object({
    collectionName: collectionNameSchema,
    points: z.array(upsertPointSchema).min(1).max(MAX_UPSERT_POINTS),
  })
  .strict();

export const pointUpsertInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["collectionName", "points"],
  properties: {
    collectionName: {
      type: "string",
      minLength: 1,
      maxLength: MAX_COLLECTION_NAME_LENGTH,
    },
    points: {
      type: "array",
      minItems: 1,
      maxItems: MAX_UPSERT_POINTS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "vector"],
        properties: {
          id: {
            oneOf: [
              { type: "string", minLength: 1, maxLength: MAX_POINT_ID_LENGTH },
              { type: "number" },
            ],
          },
          vector: {
            type: "array",
            minItems: 1,
            maxItems: MAX_VECTOR_DIMENSION,
            items: { type: "number" },
          },
          payload: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
  },
} satisfies DefineToolOptions["inputSchema"];
