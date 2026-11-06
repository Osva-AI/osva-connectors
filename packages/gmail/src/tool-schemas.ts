import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_PAGE_TOKEN_LENGTH,
  MAX_QUERY_LENGTH,
  MAX_RESOURCE_ID_LENGTH,
} from "./constants.js";
import { canonicalRecipientEmail } from "./email-address.js";

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

const querySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_QUERY_LENGTH)
  .refine((value) => !/[\0\r\n]/.test(value), "Invalid query.");

/** Tool-layer validation: canonical bare addr-spec (matches allowlist / MIME assembly). */
const recipientEmailSchema = z
  .string()
  .transform((v) => canonicalRecipientEmail(v));

const messageFormatSchema = z.enum(["minimal", "metadata", "full"]);

const metadataHeadersSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(128)
      .refine((h) => !/[\0\r\n]/.test(h), "Invalid header name."),
  )
  .max(24)
  .optional();

export const profileGetInputSchema = z.object({}).strict();

export const profileGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const messageListInputSchema = z
  .object({
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    pageToken: pageTokenSchema.optional(),
    labelIds: z.array(resourceIdSchema(128)).max(16).optional(),
    query: querySchema.optional(),
    includeSpamTrash: z.boolean().optional(),
  })
  .strict();

export const messageListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageToken: { type: "string" },
    labelIds: { type: "array", items: { type: "string" } },
    query: { type: "string" },
    includeSpamTrash: { type: "boolean" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const messageGetInputSchema = z
  .object({
    messageId: resourceIdSchema(MAX_RESOURCE_ID_LENGTH),
    format: messageFormatSchema.optional().default("metadata"),
    metadataHeaders: metadataHeadersSchema,
  })
  .strict();

export const messageGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["messageId"],
  properties: {
    messageId: { type: "string" },
    format: { type: "string", enum: ["minimal", "metadata", "full"] },
    metadataHeaders: { type: "array", items: { type: "string" } },
  },
} satisfies DefineToolOptions["inputSchema"];

export const threadListInputSchema = z
  .object({
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    pageToken: pageTokenSchema.optional(),
    labelIds: z.array(resourceIdSchema(128)).max(16).optional(),
    query: querySchema.optional(),
    includeSpamTrash: z.boolean().optional(),
  })
  .strict();

export const threadListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageToken: { type: "string" },
    labelIds: { type: "array", items: { type: "string" } },
    query: { type: "string" },
    includeSpamTrash: { type: "boolean" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const threadGetInputSchema = z
  .object({
    threadId: resourceIdSchema(MAX_RESOURCE_ID_LENGTH),
    format: messageFormatSchema.optional().default("metadata"),
    metadataHeaders: metadataHeadersSchema,
  })
  .strict();

export const threadGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["threadId"],
  properties: {
    threadId: { type: "string" },
    format: { type: "string", enum: ["minimal", "metadata", "full"] },
    metadataHeaders: { type: "array", items: { type: "string" } },
  },
} satisfies DefineToolOptions["inputSchema"];

export const labelListInputSchema = z.object({}).strict();

export const labelListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const draftListInputSchema = z
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

export const draftListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageToken: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

/** Composed plain-text only (no attachments); recipients enforced against host allowlist. */
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

export const draftCreateInputSchema = z
  .object({
    message: composedMessageSchema,
  })
  .strict();

export const draftCreateInputJsonSchema = {
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

export const draftUpdateInputSchema = z
  .object({
    draftId: resourceIdSchema(MAX_RESOURCE_ID_LENGTH),
    message: composedMessageSchema,
  })
  .strict();

export const draftUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["draftId", "message"],
  properties: {
    draftId: { type: "string" },
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

export function collectRecipientEmails(
  message: ComposedMessageInput,
): string[] {
  return [...message.to, ...(message.cc ?? []), ...(message.bcc ?? [])];
}
