import { z } from "zod";
import {
  LIST_MAX_LIMIT,
  MAX_NOTE_BODY_LENGTH,
  MAX_PAGE_NUMBER,
  MAX_SEARCH_QUERY_LENGTH,
  OUTPUT_MAX_STATUS_LENGTH,
} from "./constants.js";
import { parseZendeskResourceId } from "./resource-id.js";

const limitSchema = z.number().int().min(1).max(LIST_MAX_LIMIT);
const pageSchema = z.number().int().min(1).max(MAX_PAGE_NUMBER);
const ticketIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((value) => parseZendeskResourceId(value, "Ticket id"));
const userIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((value) => parseZendeskResourceId(value, "User id"));
const cursorSchema = z.string().trim().min(1).max(512);

export const ticketListInputSchema = z
  .object({
    limit: limitSchema.optional(),
    cursor: cursorSchema.optional(),
  })
  .strict();

export const ticketListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    cursor: { type: "string", minLength: 1, maxLength: 512 },
  },
};

export const ticketSearchInputSchema = z
  .object({
    status: z.string().trim().min(1).max(OUTPUT_MAX_STATUS_LENGTH).optional(),
    updatedSince: z
      .string()
      .trim()
      .min(1)
      .max(MAX_SEARCH_QUERY_LENGTH)
      .optional(),
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
  })
  .strict();

export const ticketSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      minLength: 1,
      maxLength: OUTPUT_MAX_STATUS_LENGTH,
    },
    updatedSince: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SEARCH_QUERY_LENGTH,
    },
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
  },
};

export const ticketGetInputSchema = z
  .object({ ticketId: ticketIdSchema })
  .strict();

export const ticketGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId"],
  properties: { ticketId: { type: ["integer", "string"] } },
};

export const ticketCommentListInputSchema = z
  .object({
    ticketId: ticketIdSchema,
    limit: limitSchema.optional(),
    cursor: cursorSchema.optional(),
  })
  .strict();

export const ticketCommentListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId"],
  properties: {
    ticketId: { type: ["integer", "string"] },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    cursor: { type: "string", minLength: 1, maxLength: 512 },
  },
};

export const userGetInputSchema = z.object({ userId: userIdSchema }).strict();

export const userGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["userId"],
  properties: { userId: { type: ["integer", "string"] } },
};

export const ticketNoteAddInputSchema = z
  .object({
    ticketId: ticketIdSchema,
    body: z.string().trim().min(1).max(MAX_NOTE_BODY_LENGTH),
  })
  .strict();

export const ticketNoteAddInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId", "body"],
  properties: {
    ticketId: { type: ["integer", "string"] },
    body: { type: "string", minLength: 1, maxLength: MAX_NOTE_BODY_LENGTH },
  },
};

export const ticketStatusSetInputSchema = z
  .object({
    ticketId: ticketIdSchema,
    status: z.string().trim().min(1).max(OUTPUT_MAX_STATUS_LENGTH),
  })
  .strict();

export const ticketStatusSetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId", "status"],
  properties: {
    ticketId: { type: ["integer", "string"] },
    status: {
      type: "string",
      minLength: 1,
      maxLength: OUTPUT_MAX_STATUS_LENGTH,
    },
  },
};
