import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_DRIVE_ID_LENGTH,
  MAX_FILENAME_LENGTH,
  MAX_ITEM_ID_LENGTH,
  MAX_NEXT_LINK_LENGTH,
  MAX_READ_CHARS,
  MAX_SEARCH_QUERY_LENGTH,
  DEFAULT_SMALL_UPLOAD_MAX_BYTES,
} from "./constants.js";

const resourceIdSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .regex(/^[a-zA-Z0-9!._-]+$/, "Invalid resource identifier.");

const nextLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NEXT_LINK_LENGTH)
  .refine((value) => !/[\0\r\n]/.test(value), "Invalid nextLink.");

const searchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SEARCH_QUERY_LENGTH)
  .refine((value) => !/[\0\r\n]/.test(value), "Invalid query.");

const uploadFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_FILENAME_LENGTH)
  .refine(
    (value) =>
      !value.includes("/") &&
      !value.includes("\\") &&
      !value.includes("..") &&
      !value.includes("\0"),
    "Invalid file name.",
  );

const maxBase64Chars = Math.ceil((DEFAULT_SMALL_UPLOAD_MAX_BYTES / 3) * 4) + 8;

const uploadContentBase64Schema = z
  .string()
  .trim()
  .min(1)
  .max(maxBase64Chars)
  .refine((value) => !/[\0\r\n]/.test(value), "Invalid content.");

export const driveGetInputSchema = z
  .object({
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
  })
  .strict();

export const driveGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    driveId: {
      type: "string",
      description: "Drive id when using drive allowlist.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const itemListInputSchema = z
  .object({
    itemId: resourceIdSchema(MAX_ITEM_ID_LENGTH).optional(),
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    nextLink: nextLinkSchema.optional(),
  })
  .strict();

export const itemListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    itemId: { type: "string" },
    driveId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const itemGetInputSchema = z
  .object({
    itemId: resourceIdSchema(MAX_ITEM_ID_LENGTH),
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
  })
  .strict();

export const itemGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["itemId"],
  properties: {
    itemId: { type: "string" },
    driveId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const fileReadInputSchema = z
  .object({
    itemId: resourceIdSchema(MAX_ITEM_ID_LENGTH),
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
    maxChars: z.number().int().min(1).max(MAX_READ_CHARS).optional(),
  })
  .strict();

export const fileReadInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["itemId"],
  properties: {
    itemId: { type: "string" },
    driveId: { type: "string" },
    maxChars: { type: "integer", minimum: 1, maximum: MAX_READ_CHARS },
  },
} satisfies DefineToolOptions["inputSchema"];

export const fileSearchInputSchema = z
  .object({
    query: searchQuerySchema,
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    nextLink: nextLinkSchema.optional(),
  })
  .strict();

export const fileSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", description: "Bounded search query." },
    driveId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const fileUploadSmallInputSchema = z
  .object({
    parentItemId: resourceIdSchema(MAX_ITEM_ID_LENGTH),
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
    filename: uploadFilenameSchema,
    contentBase64: uploadContentBase64Schema,
  })
  .strict();

export const fileUploadSmallInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["parentItemId", "filename", "contentBase64"],
  properties: {
    parentItemId: { type: "string" },
    driveId: { type: "string" },
    filename: { type: "string" },
    contentBase64: {
      type: "string",
      description: "Base64-encoded file bytes for small upload.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];
