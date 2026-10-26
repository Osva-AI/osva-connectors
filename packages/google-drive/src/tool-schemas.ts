import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_DRIVE_QUERY_LENGTH,
  MAX_PAGE_TOKEN_LENGTH,
  MAX_FILE_ID_LENGTH,
  MAX_DRIVE_ID_LENGTH,
  MAX_READ_CHARS,
} from "./constants.js";

const resourceIdSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid resource identifier.");

const pageTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PAGE_TOKEN_LENGTH)
  .refine((value) => !/[\0\r\n]/.test(value), "Invalid pageToken.");

const driveQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DRIVE_QUERY_LENGTH)
  .refine((value) => !/[\0\r\n]/.test(value), "Invalid query.");

const orderByAllowlist = [
  "createdTime",
  "createdTime desc",
  "folder",
  "modifiedByMeTime",
  "modifiedByMeTime desc",
  "modifiedTime",
  "modifiedTime desc",
  "name",
  "name desc",
  "name_natural",
  "name_natural desc",
  "quotaBytesUsed",
  "quotaBytesUsed desc",
  "recency",
  "recency desc",
  "sharedWithMeTime",
  "sharedWithMeTime desc",
  "starred",
  "starred desc",
  "viewedByMeTime",
  "viewedByMeTime desc",
] as const;

const exportFormatSchema = z.enum([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const fileListInputSchema = z
  .object({
    query: driveQuerySchema.optional(),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    pageToken: pageTokenSchema.optional(),
    orderBy: z.enum(orderByAllowlist).optional(),
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
    includeSharedDrives: z.boolean().optional(),
  })
  .strict();

export const fileListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    query: { type: "string", description: "Drive search query (bounded)." },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageToken: { type: "string" },
    orderBy: { type: "string", enum: [...orderByAllowlist] },
    driveId: { type: "string" },
    includeSharedDrives: { type: "boolean" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const fileGetInputSchema = z
  .object({
    fileId: resourceIdSchema(MAX_FILE_ID_LENGTH),
  })
  .strict();

export const fileGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fileId"],
  properties: {
    fileId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const fileReadInputSchema = z
  .object({
    fileId: resourceIdSchema(MAX_FILE_ID_LENGTH),
    maxChars: z.number().int().min(1).max(MAX_READ_CHARS).optional(),
  })
  .strict();

export const fileReadInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fileId"],
  properties: {
    fileId: { type: "string" },
    maxChars: { type: "integer", minimum: 1, maximum: MAX_READ_CHARS },
  },
} satisfies DefineToolOptions["inputSchema"];

export const fileExportInputSchema = z
  .object({
    fileId: resourceIdSchema(MAX_FILE_ID_LENGTH),
    format: exportFormatSchema,
  })
  .strict();

export const fileExportInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fileId", "format"],
  properties: {
    fileId: { type: "string" },
    format: {
      type: "string",
      enum: [
        "text/plain",
        "text/csv",
        "text/markdown",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const folderListInputSchema = z
  .object({
    folderId: resourceIdSchema(MAX_FILE_ID_LENGTH),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    pageToken: pageTokenSchema.optional(),
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
  })
  .strict();

export const folderListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["folderId"],
  properties: {
    folderId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageToken: { type: "string" },
    driveId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const sharedDriveListInputSchema = z
  .object({
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    pageToken: pageTokenSchema.optional(),
  })
  .strict();

export const sharedDriveListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageToken: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const changesStartInputSchema = z
  .object({
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
  })
  .strict();

export const changesStartInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    driveId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const changesListInputSchema = z
  .object({
    pageToken: pageTokenSchema,
    driveId: resourceIdSchema(MAX_DRIVE_ID_LENGTH).optional(),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
  })
  .strict();

export const changesListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pageToken"],
  properties: {
    pageToken: { type: "string" },
    driveId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
  },
} satisfies DefineToolOptions["inputSchema"];
