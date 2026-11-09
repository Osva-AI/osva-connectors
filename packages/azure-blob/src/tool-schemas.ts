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

const containerSchema = z.string().trim().min(1).max(MAX_BUCKET_NAME_LENGTH);
const keySchema = z.string().trim().min(1).max(MAX_OBJECT_KEY_LENGTH);
const prefixSchema = z.string().trim().max(MAX_SEARCH_PREFIX_LENGTH);
const limitSchema = z.number().int().min(1).max(LIST_MAX_PAGE_SIZE);
const continuationSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONTINUATION_TOKEN_LENGTH);
const etagSchema = z.string().trim().min(1).max(MAX_ETAG_LENGTH);

export const containerListInputSchema = z
  .object({
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const containerListInputJsonSchema = {
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

export const containerGetInputSchema = z
  .object({ container: containerSchema })
  .strict();

export const containerGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["container"],
  properties: {
    container: {
      type: "string",
      minLength: 1,
      maxLength: MAX_BUCKET_NAME_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const blobListInputSchema = z
  .object({
    container: containerSchema,
    prefix: prefixSchema,
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const blobListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["container", "prefix"],
  properties: {
    container: {
      type: "string",
      minLength: 1,
      maxLength: MAX_BUCKET_NAME_LENGTH,
    },
    prefix: { type: "string", maxLength: MAX_SEARCH_PREFIX_LENGTH },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const blobMetadataGetInputSchema = z
  .object({ container: containerSchema, key: keySchema })
  .strict();

export const blobMetadataGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["container", "key"],
  properties: {
    container: {
      type: "string",
      minLength: 1,
      maxLength: MAX_BUCKET_NAME_LENGTH,
    },
    key: { type: "string", minLength: 1, maxLength: MAX_OBJECT_KEY_LENGTH },
  },
} satisfies DefineToolOptions["inputSchema"];

export const blobTextReadInputSchema = blobMetadataGetInputSchema;
export const blobTextReadInputJsonSchema = blobMetadataGetInputJsonSchema;

export const blobVersionsListInputSchema = z
  .object({
    container: containerSchema,
    prefix: prefixSchema,
    limit: limitSchema.optional(),
    continuationToken: continuationSchema.optional(),
  })
  .strict();

export const blobVersionsListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["container", "prefix"],
  properties: {
    container: {
      type: "string",
      minLength: 1,
      maxLength: MAX_BUCKET_NAME_LENGTH,
    },
    prefix: { type: "string", maxLength: MAX_SEARCH_PREFIX_LENGTH },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const blobTextCreateInputSchema = z
  .object({
    container: containerSchema,
    key: keySchema,
    content: z.string(),
  })
  .strict();

export const blobTextCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["container", "key", "content"],
  properties: {
    container: {
      type: "string",
      minLength: 1,
      maxLength: MAX_BUCKET_NAME_LENGTH,
    },
    key: { type: "string", minLength: 1, maxLength: MAX_OBJECT_KEY_LENGTH },
    content: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const blobTextReplaceInputSchema = z
  .object({
    container: containerSchema,
    key: keySchema,
    content: z.string(),
    expectedETag: etagSchema,
  })
  .strict();

export const blobTextReplaceInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["container", "key", "content", "expectedETag"],
  properties: {
    container: {
      type: "string",
      minLength: 1,
      maxLength: MAX_BUCKET_NAME_LENGTH,
    },
    key: { type: "string", minLength: 1, maxLength: MAX_OBJECT_KEY_LENGTH },
    content: { type: "string" },
    expectedETag: {
      type: "string",
      minLength: 1,
      maxLength: MAX_ETAG_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

/** @deprecated use blobTextCreateInputSchema — retained for host-approval test import name */
export const objectCreateInputSchema = blobTextCreateInputSchema;
/** @deprecated use blobTextReplaceInputSchema — retained for host-approval test import name */
export const objectReplaceInputSchema = blobTextReplaceInputSchema;
