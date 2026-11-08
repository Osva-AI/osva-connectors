import { z } from "zod";
import {
  LIST_MAX_PER_PAGE,
  MAX_NOTE_BODY_LENGTH,
  MAX_PAGE_NUMBER,
  MAX_SEARCH_QUERY_LENGTH,
} from "./constants.js";
import {
  parseIntercomContactId,
  parseIntercomConversationId,
} from "./resource-id.js";

const pageSchema = z.number().int().min(1).max(MAX_PAGE_NUMBER);
const perPageSchema = z.number().int().min(1).max(LIST_MAX_PER_PAGE);
const conversationIdSchema = z
  .union([z.string().trim().min(1), z.number()])
  .transform((v) => parseIntercomConversationId(v, "Conversation id"));
const contactIdSchema = z
  .union([z.string().trim().min(1), z.number()])
  .transform((v) => parseIntercomContactId(v, "Contact id"));

export const conversationListInputSchema = z
  .object({ page: pageSchema.optional(), perPage: perPageSchema.optional() })
  .strict();
export const conversationListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    perPage: { type: "integer", minimum: 1, maximum: LIST_MAX_PER_PAGE },
  },
};

export const conversationGetInputSchema = z
  .object({ conversationId: conversationIdSchema })
  .strict();
export const conversationGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["conversationId"],
  properties: { conversationId: { type: ["string", "integer"] } },
};

export const conversationSearchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH),
    page: pageSchema.optional(),
  })
  .strict();
export const conversationSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: MAX_SEARCH_QUERY_LENGTH },
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
  },
};

export const contactListInputSchema = conversationListInputSchema;
export const contactListInputJsonSchema = conversationListInputJsonSchema;

export const contactGetInputSchema = z
  .object({ contactId: contactIdSchema })
  .strict();
export const contactGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contactId"],
  properties: { contactId: { type: ["string", "integer"] } },
};

export const contactSearchInputSchema = conversationSearchInputSchema;
export const contactSearchInputJsonSchema = conversationSearchInputJsonSchema;

export const adminListInputSchema = z.object({}).strict();
export const adminListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

export const conversationNoteAddInputSchema = z
  .object({
    conversationId: conversationIdSchema,
    body: z.string().trim().min(1).max(MAX_NOTE_BODY_LENGTH),
  })
  .strict();
export const conversationNoteAddInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["conversationId", "body"],
  properties: {
    conversationId: { type: ["string", "integer"] },
    body: { type: "string", minLength: 1, maxLength: MAX_NOTE_BODY_LENGTH },
  },
};

export const conversationStateSetInputSchema = z
  .object({
    conversationId: conversationIdSchema,
    state: z.string().trim().min(1).max(32),
  })
  .strict();
export const conversationStateSetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["conversationId", "state"],
  properties: {
    conversationId: { type: ["string", "integer"] },
    state: { type: "string", minLength: 1, maxLength: 32 },
  },
};
