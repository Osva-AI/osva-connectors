import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  MAX_BUCKET_NAME_LENGTH,
  MAX_CONTINUATION_TOKEN_LENGTH,
  MAX_ETAG_LENGTH,
  MAX_OBJECT_KEY_LENGTH,
  MAX_SEARCH_PREFIX_LENGTH,
  LIST_MAX_PAGE_SIZE,
} from "./constants.js";

const bucketSchema = z.string().trim().min(1).max(MAX_BUCKET_NAME_LENGTH);
const keySchema = z.string().trim().min(1).max(MAX_OBJECT_KEY_LENGTH);
const prefixSchema = z.string().trim().max(MAX_SEARCH_PREFIX_LENGTH);
const limitSchema = z.number().int().min(1).max(LIST_MAX_PAGE_SIZE);
const continuationSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONTINUATION_TOKEN_LENGTH);
const etagSchema = z.string().trim().min(1).max(MAX_ETAG_LENGTH);

export const bucketListInputSchema = z
  .object({
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const bucketListInputJsonSchema = {
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

export const bucketGetInputSchema = z.object({ bucket: bucketSchema }).strict();

export const bucketGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bucket"],
  properties: {
    bucket: { type: "string", minLength: 1, maxLength: MAX_BUCKET_NAME_LENGTH },
  },
} satisfies DefineToolOptions["inputSchema"];

export const objectListInputSchema = z
  .object({
    bucket: bucketSchema,
    prefix: prefixSchema,
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const objectListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bucket", "prefix"],
  properties: {
    bucket: { type: "string", minLength: 1, maxLength: MAX_BUCKET_NAME_LENGTH },
    prefix: { type: "string", maxLength: MAX_SEARCH_PREFIX_LENGTH },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const objectMetadataGetInputSchema = z
  .object({ bucket: bucketSchema, key: keySchema })
  .strict();

export const objectMetadataGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bucket", "key"],
  properties: {
    bucket: { type: "string", minLength: 1, maxLength: MAX_BUCKET_NAME_LENGTH },
    key: { type: "string", minLength: 1, maxLength: MAX_OBJECT_KEY_LENGTH },
  },
} satisfies DefineToolOptions["inputSchema"];

export const objectTextReadInputSchema = objectMetadataGetInputSchema;
export const objectTextReadInputJsonSchema = objectMetadataGetInputJsonSchema;

export const objectVersionsListInputSchema = z
  .object({
    bucket: bucketSchema,
    prefix: prefixSchema,
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const objectVersionsListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bucket", "prefix"],
  properties: {
    bucket: { type: "string", minLength: 1, maxLength: MAX_BUCKET_NAME_LENGTH },
    prefix: { type: "string", maxLength: MAX_SEARCH_PREFIX_LENGTH },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const objectTextCreateInputSchema = z
  .object({
    bucket: bucketSchema,
    key: keySchema,
    content: z.string(),
  })
  .strict();

export const objectTextCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bucket", "key", "content"],
  properties: {
    bucket: { type: "string", minLength: 1, maxLength: MAX_BUCKET_NAME_LENGTH },
    key: { type: "string", minLength: 1, maxLength: MAX_OBJECT_KEY_LENGTH },
    content: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const objectTextReplaceInputSchema = z
  .object({
    bucket: bucketSchema,
    key: keySchema,
    content: z.string(),
    expectedETag: etagSchema,
  })
  .strict();

export const objectTextReplaceInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bucket", "key", "content", "expectedETag"],
  properties: {
    bucket: { type: "string", minLength: 1, maxLength: MAX_BUCKET_NAME_LENGTH },
    key: { type: "string", minLength: 1, maxLength: MAX_OBJECT_KEY_LENGTH },
    content: { type: "string" },
    expectedETag: {
      type: "string",
      minLength: 1,
      maxLength: MAX_ETAG_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];
