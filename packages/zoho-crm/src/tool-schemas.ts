import { z } from "zod";
import {
  LIST_MAX_PER_PAGE,
  MAX_NOTE_BODY_LENGTH,
  MAX_NOTE_TITLE_LENGTH,
  MAX_PAGE_NUMBER,
  MAX_STAGE_LENGTH,
} from "./constants.js";
import { parseZohoRecordId } from "./resource-id.js";

const pageSchema = z.number().int().min(1).max(MAX_PAGE_NUMBER);
const perPageSchema = z.number().int().min(1).max(LIST_MAX_PER_PAGE);

const recordIdSchema = z
  .string()
  .trim()
  .min(1)
  .transform((v) => parseZohoRecordId(v, "Record id"));

const listPageJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    perPage: { type: "integer", minimum: 1, maximum: LIST_MAX_PER_PAGE },
  },
} as const;

export const listPageInputSchema = z
  .object({ page: pageSchema.optional(), perPage: perPageSchema.optional() })
  .strict();

export const leadListInputSchema = listPageInputSchema;
export const leadListInputJsonSchema = listPageJsonSchema;

export const leadGetInputSchema = z.object({ leadId: recordIdSchema }).strict();
export const leadGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["leadId"],
  properties: { leadId: { type: "string", minLength: 1 } },
};

export const accountListInputSchema = listPageInputSchema;
export const accountListInputJsonSchema = listPageJsonSchema;

export const accountGetInputSchema = z
  .object({ accountId: recordIdSchema })
  .strict();
export const accountGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accountId"],
  properties: { accountId: { type: "string", minLength: 1 } },
};

export const contactListInputSchema = listPageInputSchema;
export const contactListInputJsonSchema = listPageJsonSchema;

export const contactGetInputSchema = z
  .object({ contactId: recordIdSchema })
  .strict();
export const contactGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contactId"],
  properties: { contactId: { type: "string", minLength: 1 } },
};

export const dealListInputSchema = listPageInputSchema;
export const dealListInputJsonSchema = listPageJsonSchema;

export const dealGetInputSchema = z.object({ dealId: recordIdSchema }).strict();
export const dealGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dealId"],
  properties: { dealId: { type: "string", minLength: 1 } },
};

export const dealStageListInputSchema = z.object({}).strict();
export const dealStageListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

export const dealStageSetInputSchema = z
  .object({
    dealId: recordIdSchema,
    stage: z.string().trim().min(1).max(MAX_STAGE_LENGTH),
  })
  .strict();
export const dealStageSetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dealId", "stage"],
  properties: {
    dealId: { type: "string", minLength: 1 },
    stage: { type: "string", minLength: 1, maxLength: MAX_STAGE_LENGTH },
  },
};

export const dealNoteAddInputSchema = z
  .object({
    dealId: recordIdSchema,
    body: z.string().trim().min(1).max(MAX_NOTE_BODY_LENGTH),
    title: z.string().trim().min(1).max(MAX_NOTE_TITLE_LENGTH).optional(),
  })
  .strict();
export const dealNoteAddInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dealId", "body"],
  properties: {
    dealId: { type: "string", minLength: 1 },
    body: { type: "string", minLength: 1, maxLength: MAX_NOTE_BODY_LENGTH },
    title: { type: "string", minLength: 1, maxLength: MAX_NOTE_TITLE_LENGTH },
  },
};
