import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_GRAPH_RESOURCE_ID_LENGTH,
  MAX_ODATA_LINK_LENGTH,
} from "./constants.js";
import {
  parseGraphResourceId,
  parseTeamId,
  validateODataNextLink,
} from "./teams-id.js";

const graphIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(MAX_GRAPH_RESOURCE_ID_LENGTH)
    .transform((v) => parseGraphResourceId(v, label));

const teamIdSchema = z
  .string()
  .trim()
  .min(1)
  .transform((v) => parseTeamId(v));

const nextLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ODATA_LINK_LENGTH)
  .transform((v) => {
    const validated = validateODataNextLink(v);
    if (validated === undefined) {
      throw new Error("Invalid nextLink.");
    }
    return validated;
  });

const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(LIST_MAX_PAGE_SIZE)
  .optional()
  .default(LIST_DEFAULT_PAGE_SIZE);

const listEnvelopeSchema = z
  .object({
    pageSize: pageSizeSchema,
    nextLink: nextLinkSchema.optional(),
  })
  .strict();

const contentTypeSchema = z.enum(["text", "html"]);

const messageContentSchema = z.string().trim().min(1).max(28_672);

export const teamListInputSchema = listEnvelopeSchema;

export const teamListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const channelListInputSchema = listEnvelopeSchema
  .extend({
    teamId: teamIdSchema,
  })
  .strict();

export const channelListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["teamId"],
  properties: {
    teamId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const channelMessageListInputSchema = listEnvelopeSchema
  .extend({
    teamId: teamIdSchema,
    channelId: graphIdSchema("channel ID"),
  })
  .strict();

export const channelMessageListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["teamId", "channelId"],
  properties: {
    teamId: { type: "string" },
    channelId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const channelReplyListInputSchema = listEnvelopeSchema
  .extend({
    teamId: teamIdSchema,
    channelId: graphIdSchema("channel ID"),
    messageId: graphIdSchema("message ID"),
  })
  .strict();

export const channelReplyListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["teamId", "channelId", "messageId"],
  properties: {
    teamId: { type: "string" },
    channelId: { type: "string" },
    messageId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const chatListInputSchema = listEnvelopeSchema;

export const chatListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const chatMessageListInputSchema = listEnvelopeSchema
  .extend({
    chatId: graphIdSchema("chat ID"),
  })
  .strict();

export const chatMessageListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["chatId"],
  properties: {
    chatId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const channelMessageSendInputSchema = z
  .object({
    teamId: teamIdSchema,
    channelId: graphIdSchema("channel ID"),
    content: messageContentSchema,
    contentType: contentTypeSchema.optional().default("text"),
  })
  .strict();

export const channelMessageSendInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["teamId", "channelId", "content"],
  properties: {
    teamId: { type: "string" },
    channelId: { type: "string" },
    content: { type: "string" },
    contentType: { type: "string", enum: ["text", "html"] },
  },
} satisfies DefineToolOptions["inputSchema"];

export const chatMessageSendInputSchema = z
  .object({
    chatId: graphIdSchema("chat ID"),
    content: messageContentSchema,
    contentType: contentTypeSchema.optional().default("text"),
  })
  .strict();

export const chatMessageSendInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["chatId", "content"],
  properties: {
    chatId: { type: "string" },
    content: { type: "string" },
    contentType: { type: "string", enum: ["text", "html"] },
  },
} satisfies DefineToolOptions["inputSchema"];
