import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  ALLOWED_CONVERSATION_TYPES,
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  MAX_CURSOR_LENGTH,
  MAX_MESSAGE_TEXT_INPUT_LENGTH,
  SLACK_CHANNEL_ID_PATTERN,
  SLACK_MESSAGE_TS_PATTERN,
} from "./constants.js";

const channelIdSchema = z
  .string()
  .trim()
  .regex(SLACK_CHANNEL_ID_PATTERN, "Invalid Slack channel ID.");

const messageTsSchema = z
  .string()
  .trim()
  .regex(SLACK_MESSAGE_TS_PATTERN, "Invalid Slack message timestamp.");

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

const limitSchema = (defaultLimit: number, maxLimit: number) =>
  z.number().int().min(1).max(maxLimit).optional().default(defaultLimit);

export const authTestInputSchema = z.object({}).strict();

export const channelListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    cursor: cursorSchema,
    types: z
      .array(z.enum(ALLOWED_CONVERSATION_TYPES))
      .max(ALLOWED_CONVERSATION_TYPES.length)
      .optional(),
  })
  .strict();

export const channelInfoInputSchema = z
  .object({
    channelId: channelIdSchema,
  })
  .strict();

export const messageHistoryInputSchema = z
  .object({
    channelId: channelIdSchema,
    limit: limitSchema(HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT),
    cursor: cursorSchema,
    oldest: messageTsSchema.optional(),
    latest: messageTsSchema.optional(),
  })
  .strict();

export const messageThreadInputSchema = z
  .object({
    channelId: channelIdSchema,
    threadTs: messageTsSchema,
    limit: limitSchema(HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT),
    cursor: cursorSchema,
  })
  .strict();

export const messagePostInputSchema = z
  .object({
    channelId: channelIdSchema,
    text: z.string().trim().min(1).max(MAX_MESSAGE_TEXT_INPUT_LENGTH),
  })
  .strict();

export const messageReplyInputSchema = z
  .object({
    channelId: channelIdSchema,
    threadTs: messageTsSchema,
    text: z.string().trim().min(1).max(MAX_MESSAGE_TEXT_INPUT_LENGTH),
  })
  .strict();

export const authTestInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const channelListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: LIST_MAX_LIMIT,
      description: "Maximum channels per Slack page (default 50).",
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
      description:
        "Slack conversations.list cursor from a previous nextCursor.",
    },
    types: {
      type: "array",
      items: {
        type: "string",
        enum: [...ALLOWED_CONVERSATION_TYPES],
      },
      description: "Optional channel types (public_channel, private_channel).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const channelInfoInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["channelId"],
  properties: {
    channelId: {
      type: "string",
      description: "Slack channel ID (C… or G…).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const messageHistoryInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["channelId"],
  properties: {
    channelId: { type: "string" },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: HISTORY_MAX_LIMIT,
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
    },
    oldest: { type: "string", description: "Slack message ts (inclusive)." },
    latest: { type: "string", description: "Slack message ts (inclusive)." },
  },
} satisfies DefineToolOptions["inputSchema"];

export const messageThreadInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["channelId", "threadTs"],
  properties: {
    channelId: { type: "string" },
    threadTs: { type: "string", description: "Parent message timestamp." },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: HISTORY_MAX_LIMIT,
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const messagePostInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["channelId", "text"],
  properties: {
    channelId: { type: "string" },
    text: {
      type: "string",
      minLength: 1,
      maxLength: MAX_MESSAGE_TEXT_INPUT_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const messageReplyInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["channelId", "threadTs", "text"],
  properties: {
    channelId: { type: "string" },
    threadTs: { type: "string" },
    text: {
      type: "string",
      minLength: 1,
      maxLength: MAX_MESSAGE_TEXT_INPUT_LENGTH,
    },
  },
} satisfies DefineToolOptions["inputSchema"];
