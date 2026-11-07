import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_APPEND_BLOCKS,
  MAX_CURSOR_LENGTH,
  MAX_NOTION_ID_LENGTH,
} from "./constants.js";
import { parseNotionId } from "./notion-id.js";

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

const notionIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(MAX_NOTION_ID_LENGTH)
    .transform((value, ctx) => {
      try {
        return parseNotionId(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(LIST_MAX_PAGE_SIZE)
  .optional()
  .default(LIST_DEFAULT_PAGE_SIZE);

const pageSizeJson = {
  type: "integer",
  minimum: 1,
  maximum: LIST_MAX_PAGE_SIZE,
} as const;

export const searchInputSchema = z
  .object({
    query: z.string().max(512).optional(),
    pageSize: pageSizeSchema,
    startCursor: cursorSchema,
    objectType: z.enum(["page", "database", "data_source"]).optional(),
  })
  .strict();

export const searchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    query: { type: "string", maxLength: 512 },
    pageSize: pageSizeJson,
    startCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
    objectType: {
      type: "string",
      enum: ["page", "database", "data_source"],
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const pageGetInputSchema = z
  .object({
    pageId: notionIdSchema("page ID"),
  })
  .strict();

export const pageGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pageId"],
  properties: {
    pageId: { type: "string", minLength: 1, maxLength: MAX_NOTION_ID_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const blockChildrenListInputSchema = z
  .object({
    blockId: notionIdSchema("block ID"),
    pageSize: pageSizeSchema,
    startCursor: cursorSchema,
  })
  .strict();

export const blockChildrenListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["blockId"],
  properties: {
    blockId: { type: "string", minLength: 1, maxLength: MAX_NOTION_ID_LENGTH },
    pageSize: pageSizeJson,
    startCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const databaseGetInputSchema = z
  .object({
    databaseId: notionIdSchema("database ID"),
  })
  .strict();

export const databaseGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["databaseId"],
  properties: {
    databaseId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_NOTION_ID_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const datasourceGetInputSchema = z
  .object({
    dataSourceId: notionIdSchema("data source ID"),
  })
  .strict();

export const datasourceGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dataSourceId"],
  properties: {
    dataSourceId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_NOTION_ID_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const datasourceQueryInputSchema = z
  .object({
    dataSourceId: notionIdSchema("data source ID"),
    pageSize: pageSizeSchema,
    startCursor: cursorSchema,
    filter: z.record(z.string(), z.unknown()).optional(),
    sorts: z.array(z.record(z.string(), z.unknown())).max(8).optional(),
    filterProperties: z.array(z.string().max(128)).max(16).optional(),
  })
  .strict();

export const datasourceQueryInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dataSourceId"],
  properties: {
    dataSourceId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_NOTION_ID_LENGTH,
    },
    pageSize: pageSizeJson,
    startCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
    filter: { type: "object", additionalProperties: true },
    sorts: { type: "array", maxItems: 8, items: { type: "object" } },
    filterProperties: {
      type: "array",
      maxItems: 16,
      items: { type: "string", maxLength: 128 },
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

const parentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("page_id"),
      pageId: notionIdSchema("parent page ID"),
    })
    .strict(),
  z
    .object({
      type: z.literal("database_id"),
      databaseId: notionIdSchema("parent database ID"),
    })
    .strict(),
  z
    .object({
      type: z.literal("data_source_id"),
      dataSourceId: notionIdSchema("parent data source ID"),
    })
    .strict(),
]);

export const pageCreateInputSchema = z
  .object({
    parent: parentSchema,
    properties: z.record(z.string(), z.unknown()).optional(),
    children: z
      .array(z.record(z.string(), z.unknown()))
      .max(MAX_APPEND_BLOCKS)
      .optional(),
  })
  .strict();

export const pageCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["parent"],
  properties: {
    parent: {
      type: "object",
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "pageId"],
          properties: {
            type: { const: "page_id" },
            pageId: { type: "string" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "databaseId"],
          properties: {
            type: { const: "database_id" },
            databaseId: { type: "string" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "dataSourceId"],
          properties: {
            type: { const: "data_source_id" },
            dataSourceId: { type: "string" },
          },
        },
      ],
    },
    properties: { type: "object", additionalProperties: true },
    children: {
      type: "array",
      maxItems: MAX_APPEND_BLOCKS,
      items: { type: "object" },
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

const blockAppendPositionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("end") }).strict(),
  z.object({ type: z.literal("start") }).strict(),
  z
    .object({
      type: z.literal("after_block"),
      afterBlockId: notionIdSchema("after_block block ID"),
    })
    .strict(),
]);

export const pageUpdateInputSchema = z
  .object({
    pageId: notionIdSchema("page ID"),
    properties: z.record(z.string(), z.unknown()).optional(),
    inTrash: z.boolean().optional(),
  })
  .strict();

export const pageUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pageId"],
  properties: {
    pageId: { type: "string", minLength: 1, maxLength: MAX_NOTION_ID_LENGTH },
    properties: { type: "object", additionalProperties: true },
    inTrash: { type: "boolean" },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const blockChildrenAppendInputSchema = z
  .object({
    blockId: notionIdSchema("block ID"),
    children: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(MAX_APPEND_BLOCKS),
    position: blockAppendPositionSchema.optional(),
  })
  .strict();

export const blockChildrenAppendInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["blockId", "children"],
  properties: {
    blockId: { type: "string", minLength: 1, maxLength: MAX_NOTION_ID_LENGTH },
    children: {
      type: "array",
      minItems: 1,
      maxItems: MAX_APPEND_BLOCKS,
      items: { type: "object" },
    },
    position: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: { type: "string", enum: ["end", "start", "after_block"] },
        afterBlockId: { type: "string" },
      },
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];
