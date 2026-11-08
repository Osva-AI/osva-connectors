import { z } from "zod";
import {
  LIST_MAX_PER_PAGE,
  MAX_NOTE_BODY_LENGTH,
  MAX_PAGE_NUMBER,
  MAX_SEARCH_QUERY_LENGTH,
} from "./constants.js";
import { parseFreshdeskResourceId } from "./resource-id.js";

const pageSchema = z.number().int().min(1).max(MAX_PAGE_NUMBER);
const perPageSchema = z.number().int().min(1).max(LIST_MAX_PER_PAGE);
const ticketIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((v) => parseFreshdeskResourceId(v, "Ticket id"));
const contactIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((v) => parseFreshdeskResourceId(v, "Contact id"));

export const ticketListInputSchema = z
  .object({ page: pageSchema.optional(), perPage: perPageSchema.optional() })
  .strict();
export const ticketListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    perPage: { type: "integer", minimum: 1, maximum: LIST_MAX_PER_PAGE },
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

export const ticketSearchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH),
    page: pageSchema.optional(),
  })
  .strict();
export const ticketSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: MAX_SEARCH_QUERY_LENGTH },
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
  },
};

export const ticketConversationListInputSchema = z
  .object({ ticketId: ticketIdSchema })
  .strict();
export const ticketConversationListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId"],
  properties: { ticketId: { type: ["integer", "string"] } },
};

export const contactListInputSchema = ticketListInputSchema;
export const contactListInputJsonSchema = ticketListInputJsonSchema;

export const contactGetInputSchema = z
  .object({ contactId: contactIdSchema })
  .strict();
export const contactGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contactId"],
  properties: { contactId: { type: ["integer", "string"] } },
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
    status: z.string().trim().min(1).max(32),
  })
  .strict();
export const ticketStatusSetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId", "status"],
  properties: {
    ticketId: { type: ["integer", "string"] },
    status: { type: "string", minLength: 1, maxLength: 32 },
  },
};
