import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_GRAPH_ID_LENGTH,
  MAX_NEXT_LINK_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
} from "./constants.js";
import { parseBoundedSearchQuery } from "./graph-id.js";
import { canonicalRecipientEmail } from "./send-policy.js";

const graphIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(MAX_GRAPH_ID_LENGTH)
    .regex(/^[A-Za-z0-9_-]+$/, `Invalid ${label}.`);

const nextLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NEXT_LINK_LENGTH)
  .refine((value) => !/[\0\r\n]/.test(value), "Invalid nextLink.");

const recipientEmailSchema = z
  .string()
  .transform((v) => canonicalRecipientEmail(v));

const searchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SEARCH_QUERY_LENGTH)
  .transform((v) => parseBoundedSearchQuery(v));

export const mailFolderListInputSchema = z
  .object({
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

export const mailFolderListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const messageListInputSchema = z
  .object({
    mailFolderId: graphIdSchema("mail folder ID"),
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

export const messageListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mailFolderId"],
  properties: {
    mailFolderId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const messageGetInputSchema = z
  .object({
    messageId: graphIdSchema("message ID"),
  })
  .strict();

export const messageGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["messageId"],
  properties: {
    messageId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const messageSearchInputSchema = z
  .object({
    query: searchQuerySchema,
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

export const messageSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const calendarListInputSchema = z
  .object({
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

export const calendarListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const eventListInputSchema = z
  .object({
    calendarId: graphIdSchema("calendar ID"),
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

export const eventListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calendarId"],
  properties: {
    calendarId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    nextLink: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const eventGetInputSchema = z
  .object({
    eventId: graphIdSchema("event ID"),
  })
  .strict();

export const eventGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["eventId"],
  properties: {
    eventId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const composedMessageSchema = z
  .object({
    to: z.array(recipientEmailSchema).min(1).max(16),
    cc: z.array(recipientEmailSchema).max(16).optional(),
    bcc: z.array(recipientEmailSchema).max(16).optional(),
    subject: z.string().trim().max(998),
    bodyPlain: z.string().max(512_000),
  })
  .strict();

export type ComposedMessageInput = z.infer<typeof composedMessageSchema>;

export const messageSendInputSchema = z
  .object({
    message: composedMessageSchema,
  })
  .strict();

export const messageSendInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: {
    message: {
      type: "object",
      additionalProperties: false,
      required: ["to", "subject", "bodyPlain"],
      properties: {
        to: { type: "array", items: { type: "string" } },
        cc: { type: "array", items: { type: "string" } },
        bcc: { type: "array", items: { type: "string" } },
        subject: { type: "string" },
        bodyPlain: { type: "string" },
      },
    },
  },
} satisfies DefineToolOptions["inputSchema"];

const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (v) => !/[\0\r\n]/.test(v) && !Number.isNaN(Date.parse(v)),
    "Invalid date/time.",
  );

export const eventCreateInputSchema = z
  .object({
    calendarId: graphIdSchema("calendar ID"),
    subject: z.string().trim().min(1).max(998),
    start: isoDateTimeSchema,
    end: isoDateTimeSchema,
    bodyPlain: z.string().max(32_768).optional(),
    location: z.string().trim().max(512).optional(),
  })
  .strict();

export const eventCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calendarId", "subject", "start", "end"],
  properties: {
    calendarId: { type: "string" },
    subject: { type: "string" },
    start: { type: "string" },
    end: { type: "string" },
    bodyPlain: { type: "string" },
    location: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export function collectRecipientEmails(
  message: ComposedMessageInput,
): string[] {
  return [...message.to, ...(message.cc ?? []), ...(message.bcc ?? [])];
}
