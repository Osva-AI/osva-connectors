import { z } from "zod";
import {
  LIST_MAX_LIMIT,
  MAX_CURSOR_LENGTH,
  MAX_SEARCH_TERM_LENGTH,
} from "./constants.js";
import { parsePipedriveResourceId } from "./resource-id.js";

const limitSchema = z.number().int().min(1).max(LIST_MAX_LIMIT).optional();
const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();
const dealIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((v) => parsePipedriveResourceId(v, "Deal id"));
const personIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((v) => parsePipedriveResourceId(v, "Person id"));
const organizationIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((v) => parsePipedriveResourceId(v, "Organization id"));
const stageIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((v) => parsePipedriveResourceId(v, "Stage id"));
const pipelineIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((v) => parsePipedriveResourceId(v, "Pipeline id"));

const listJsonProps = {
  limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
  cursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
} as const;

export const pipelineListInputSchema = z
  .object({ limit: limitSchema, cursor: cursorSchema })
  .strict();
export const pipelineListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: listJsonProps,
};

export const stageListInputSchema = z
  .object({
    limit: limitSchema,
    cursor: cursorSchema,
    pipelineId: pipelineIdSchema.optional(),
  })
  .strict();
export const stageListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...listJsonProps,
    pipelineId: { type: ["integer", "string"] },
  },
};

export const dealListInputSchema = pipelineListInputSchema;
export const dealListInputJsonSchema = pipelineListInputJsonSchema;

export const dealGetInputSchema = z.object({ dealId: dealIdSchema }).strict();
export const dealGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dealId"],
  properties: { dealId: { type: ["integer", "string"] } },
};

export const dealSearchInputSchema = z
  .object({
    term: z.string().trim().min(1).max(MAX_SEARCH_TERM_LENGTH),
    limit: limitSchema,
    cursor: cursorSchema,
  })
  .strict();
export const dealSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["term"],
  properties: {
    term: { type: "string", minLength: 1, maxLength: MAX_SEARCH_TERM_LENGTH },
    ...listJsonProps,
  },
};

export const personListInputSchema = pipelineListInputSchema;
export const personListInputJsonSchema = pipelineListInputJsonSchema;

export const personGetInputSchema = z
  .object({ personId: personIdSchema })
  .strict();
export const personGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["personId"],
  properties: { personId: { type: ["integer", "string"] } },
};

export const organizationListInputSchema = pipelineListInputSchema;
export const organizationListInputJsonSchema = pipelineListInputJsonSchema;

export const organizationGetInputSchema = z
  .object({ organizationId: organizationIdSchema })
  .strict();
export const organizationGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["organizationId"],
  properties: { organizationId: { type: ["integer", "string"] } },
};

export const dealStageSetInputSchema = z
  .object({
    dealId: dealIdSchema,
    targetStageId: stageIdSchema,
  })
  .strict();
export const dealStageSetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dealId", "targetStageId"],
  properties: {
    dealId: { type: ["integer", "string"] },
    targetStageId: { type: ["integer", "string"] },
  },
};
