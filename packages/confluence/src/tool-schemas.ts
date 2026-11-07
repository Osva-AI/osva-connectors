import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_BODY_STORAGE_LENGTH,
  MAX_CONFLUENCE_ID_LENGTH,
  MAX_CQL_LENGTH,
  MAX_CURSOR_LENGTH,
  MAX_PAGE_TITLE_LENGTH,
} from "./constants.js";
import { parseConfluenceId } from "./confluence-id.js";

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

const confluenceIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(MAX_CONFLUENCE_ID_LENGTH)
    .transform((value, ctx) => {
      try {
        return parseConfluenceId(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(LIST_MAX_PAGE_SIZE)
  .optional()
  .default(LIST_DEFAULT_PAGE_SIZE);

const limitJson = {
  type: "integer",
  minimum: 1,
  maximum: LIST_MAX_PAGE_SIZE,
} as const;

export const spaceListInputSchema = z
  .object({
    limit: limitSchema,
    cursor: cursorSchema,
  })
  .strict();

export const spaceListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: limitJson,
    cursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const spaceGetInputSchema = z
  .object({
    spaceId: confluenceIdSchema("space ID"),
  })
  .strict();

export const spaceGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spaceId"],
  properties: {
    spaceId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONFLUENCE_ID_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const pageListInputSchema = z
  .object({
    spaceId: confluenceIdSchema("space ID"),
    limit: limitSchema,
    cursor: cursorSchema,
  })
  .strict();

export const pageListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spaceId"],
  properties: {
    spaceId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONFLUENCE_ID_LENGTH,
    },
    limit: limitJson,
    cursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const pageGetInputSchema = z
  .object({
    pageId: confluenceIdSchema("page ID"),
  })
  .strict();

export const pageGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pageId"],
  properties: {
    pageId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONFLUENCE_ID_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const pageChildrenListInputSchema = z
  .object({
    pageId: confluenceIdSchema("page ID"),
    limit: limitSchema,
    cursor: cursorSchema,
  })
  .strict();

export const pageChildrenListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pageId"],
  properties: {
    pageId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONFLUENCE_ID_LENGTH,
    },
    limit: limitJson,
    cursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const searchInputSchema = z
  .object({
    cql: z.string().max(MAX_CQL_LENGTH).optional(),
    limit: limitSchema,
    cursor: cursorSchema,
  })
  .strict();

export const searchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cql: { type: "string", maxLength: MAX_CQL_LENGTH },
    limit: limitJson,
    cursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const pageCreateInputSchema = z
  .object({
    spaceId: confluenceIdSchema("space ID"),
    title: z.string().trim().min(1).max(MAX_PAGE_TITLE_LENGTH),
    bodyStorage: z.string().min(1).max(MAX_BODY_STORAGE_LENGTH),
    parentId: confluenceIdSchema("parent page ID").optional(),
  })
  .strict();

export const pageCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["spaceId", "title", "bodyStorage"],
  properties: {
    spaceId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONFLUENCE_ID_LENGTH,
    },
    title: { type: "string", minLength: 1, maxLength: MAX_PAGE_TITLE_LENGTH },
    bodyStorage: {
      type: "string",
      minLength: 1,
      maxLength: MAX_BODY_STORAGE_LENGTH,
    },
    parentId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONFLUENCE_ID_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const pageUpdateInputSchema = z
  .object({
    pageId: confluenceIdSchema("page ID"),
    versionNumber: z.number().int().min(1),
    title: z.string().trim().min(1).max(MAX_PAGE_TITLE_LENGTH).optional(),
    bodyStorage: z.string().min(1).max(MAX_BODY_STORAGE_LENGTH).optional(),
    versionMessage: z.string().max(512).optional(),
  })
  .strict()
  .refine(
    (value) => value.title !== undefined || value.bodyStorage !== undefined,
    { message: "At least one of title or bodyStorage is required." },
  );

export const pageUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pageId", "versionNumber"],
  properties: {
    pageId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONFLUENCE_ID_LENGTH,
    },
    versionNumber: { type: "integer", minimum: 1 },
    title: { type: "string", minLength: 1, maxLength: MAX_PAGE_TITLE_LENGTH },
    bodyStorage: {
      type: "string",
      minLength: 1,
      maxLength: MAX_BODY_STORAGE_LENGTH,
    },
    versionMessage: { type: "string", maxLength: 512 },
  },
} as const satisfies DefineToolOptions["inputSchema"];
