import { z } from "zod";
import {
  LIST_MAX_PER_PAGE,
  MAX_CONTINUATION_TOKEN_LENGTH,
  MAX_STAGE_NAME_LENGTH,
  MAX_TASK_SUBJECT_LENGTH,
} from "./constants.js";
import { parseSalesforceRecordId } from "./resource-id.js";

const perPageSchema = z.number().int().min(1).max(LIST_MAX_PER_PAGE);
const accountIdSchema = z
  .union([z.string().trim().min(1), z.number()])
  .transform((v) => parseSalesforceRecordId(v, "Account id"));
const contactIdSchema = z
  .union([z.string().trim().min(1), z.number()])
  .transform((v) => parseSalesforceRecordId(v, "Contact id"));
const opportunityIdSchema = z
  .union([z.string().trim().min(1), z.number()])
  .transform((v) => parseSalesforceRecordId(v, "Opportunity id"));
const recordIdSchema = z
  .union([z.string().trim().min(1), z.number()])
  .transform((v) => parseSalesforceRecordId(v, "Record id"));

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD.");

const continuationTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONTINUATION_TOKEN_LENGTH);

const stageFilterSchema = z.string().trim().min(1).max(MAX_STAGE_NAME_LENGTH);

const updatedSinceSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine(
    (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) ||
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v),
    "Updated since must be YYYY-MM-DD or ISO-8601 UTC.",
  );

const listContinuationSchema = z
  .object({
    perPage: perPageSchema.optional(),
    continuationToken: continuationTokenSchema,
  })
  .strict();

export const accountListInputSchema = z.union([
  listContinuationSchema,
  z
    .object({
      perPage: perPageSchema.optional(),
      accountId: accountIdSchema.optional(),
    })
    .strict(),
]);

export const accountListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    perPage: { type: "integer", minimum: 1, maximum: LIST_MAX_PER_PAGE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
    accountId: { type: ["string", "integer"] },
  },
};

export const accountGetInputSchema = z
  .object({ accountId: accountIdSchema })
  .strict();
export const accountGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accountId"],
  properties: { accountId: { type: ["string", "integer"] } },
};

export const contactListInputSchema = z.union([
  listContinuationSchema,
  z
    .object({
      perPage: perPageSchema.optional(),
      accountId: accountIdSchema.optional(),
    })
    .strict(),
]);

export const contactListInputJsonSchema = accountListInputJsonSchema;

export const contactGetInputSchema = z
  .object({ contactId: contactIdSchema })
  .strict();
export const contactGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contactId"],
  properties: { contactId: { type: ["string", "integer"] } },
};

export const opportunityListInputSchema = z.union([
  listContinuationSchema,
  z
    .object({
      perPage: perPageSchema.optional(),
      accountId: accountIdSchema.optional(),
      stage: stageFilterSchema.optional(),
      updatedSince: updatedSinceSchema.optional(),
      closeDateFrom: isoDateSchema.optional(),
      closeDateTo: isoDateSchema.optional(),
    })
    .strict(),
]);

export const opportunityListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    perPage: { type: "integer", minimum: 1, maximum: LIST_MAX_PER_PAGE },
    continuationToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CONTINUATION_TOKEN_LENGTH,
    },
    accountId: { type: ["string", "integer"] },
    stage: { type: "string", minLength: 1, maxLength: MAX_STAGE_NAME_LENGTH },
    updatedSince: { type: "string", minLength: 1, maxLength: 32 },
    closeDateFrom: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    closeDateTo: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
};

export const opportunityGetInputSchema = z
  .object({ opportunityId: opportunityIdSchema })
  .strict();
export const opportunityGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["opportunityId"],
  properties: { opportunityId: { type: ["string", "integer"] } },
};

export const opportunityStageListInputSchema = z.object({}).strict();
export const opportunityStageListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

export const opportunityStageSetInputSchema = z
  .object({
    opportunityId: opportunityIdSchema,
    targetStage: z.string().trim().min(1).max(MAX_STAGE_NAME_LENGTH),
  })
  .strict();
export const opportunityStageSetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["opportunityId", "targetStage"],
  properties: {
    opportunityId: { type: ["string", "integer"] },
    targetStage: {
      type: "string",
      minLength: 1,
      maxLength: MAX_STAGE_NAME_LENGTH,
    },
  },
};

const relatedRecordTypeSchema = z.enum(["Account", "Opportunity", "Contact"]);

export const taskCreateInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(MAX_TASK_SUBJECT_LENGTH),
    relatedRecordType: relatedRecordTypeSchema,
    relatedRecordId: recordIdSchema,
    dueDate: isoDateSchema.optional(),
  })
  .strict();
export const taskCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "relatedRecordType", "relatedRecordId"],
  properties: {
    subject: {
      type: "string",
      minLength: 1,
      maxLength: MAX_TASK_SUBJECT_LENGTH,
    },
    relatedRecordType: {
      type: "string",
      enum: ["Account", "Opportunity", "Contact"],
    },
    relatedRecordId: { type: ["string", "integer"] },
    dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
};
