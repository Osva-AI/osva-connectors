import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import { ALLOWED_ANALYTICS_METRICS } from "./analytics-allowlist.js";
import {
  ANALYTICS_MAX_TEMPLATE_IDS,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  MAX_CURSOR_LENGTH,
  MAX_LANGUAGE_CODE_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
  SEND_MAX_BODY_PARAMETERS,
  SEND_MAX_BODY_PARAMETER_LENGTH,
} from "./constants.js";
import {
  normalizePhoneNumberIdInput,
  normalizeRecipientE164,
  normalizeTemplateIdInput,
  normalizeWabaIdInput,
} from "./resource-id.js";

export const META_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const metaDateSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(META_DATE_PATTERN, "Dates must be YYYY-MM-DD.");

const wabaIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }
    try {
      return normalizeWabaIdInput(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Invalid WhatsApp Business Account ID.",
      });
      return z.NEVER;
    }
  });

const phoneNumberIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }
    try {
      return normalizePhoneNumberIdInput(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid phone number ID." });
      return z.NEVER;
    }
  });

const templateIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((value, ctx) => {
    try {
      return normalizeTemplateIdInput(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid template ID." });
      return z.NEVER;
    }
  });

const limitSchema = (defaultLimit: number, maxLimit: number) =>
  z.number().int().min(1).max(maxLimit).optional().default(defaultLimit);

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

export const businessAccountGetInputSchema = z.object({
  wabaId: wabaIdSchema,
});

export const businessAccountGetInputJsonSchema = {
  type: "object",
  properties: {
    wabaId: {
      type: "string",
      description:
        "Optional WABA ID; must match OSVA_CONNECTOR_WHATSAPP_WABA_ID when provided.",
    },
  },
  additionalProperties: false,
} satisfies DefineToolOptions["inputSchema"];

export const phoneNumberListInputSchema = z.object({
  wabaId: wabaIdSchema,
  limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
  after: cursorSchema,
});

export const phoneNumberListInputJsonSchema = {
  type: "object",
  properties: {
    wabaId: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    after: { type: "string" },
  },
  additionalProperties: false,
} satisfies DefineToolOptions["inputSchema"];

export const phoneNumberGetInputSchema = z.object({
  phoneNumberId: phoneNumberIdSchema,
});

export const phoneNumberGetInputJsonSchema = {
  type: "object",
  properties: {
    phoneNumberId: { type: "string" },
  },
  additionalProperties: false,
} satisfies DefineToolOptions["inputSchema"];

export const businessProfileGetInputSchema = z.object({
  phoneNumberId: phoneNumberIdSchema,
});

export const businessProfileGetInputJsonSchema = {
  type: "object",
  properties: {
    phoneNumberId: { type: "string" },
  },
  additionalProperties: false,
} satisfies DefineToolOptions["inputSchema"];

export const templateListInputSchema = z.object({
  wabaId: wabaIdSchema,
  limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
  after: cursorSchema,
});

export const templateListInputJsonSchema = {
  type: "object",
  properties: {
    wabaId: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    after: { type: "string" },
  },
  additionalProperties: false,
} satisfies DefineToolOptions["inputSchema"];

export const templateGetInputSchema = z.object({
  templateId: templateIdSchema,
});

export const templateGetInputJsonSchema = {
  type: "object",
  properties: {
    templateId: { type: "string" },
  },
  required: ["templateId"],
  additionalProperties: false,
} satisfies DefineToolOptions["inputSchema"];

export const analyticsGetInputSchema = z.object({
  wabaId: wabaIdSchema,
  startDate: metaDateSchema,
  endDate: metaDateSchema,
  templateIds: z.array(templateIdSchema).min(1).max(ANALYTICS_MAX_TEMPLATE_IDS),
  metricTypes: z
    .array(
      z
        .string()
        .trim()
        .refine(
          (value) =>
            (ALLOWED_ANALYTICS_METRICS as readonly string[]).includes(
              value.toUpperCase(),
            ),
          "Unsupported analytics metric.",
        ),
    )
    .min(1)
    .max(ALLOWED_ANALYTICS_METRICS.length),
  useWabaTimezone: z.boolean().optional().default(false),
});

export const analyticsGetInputJsonSchema = {
  type: "object",
  properties: {
    wabaId: { type: "string" },
    startDate: { type: "string", description: "YYYY-MM-DD" },
    endDate: { type: "string", description: "YYYY-MM-DD" },
    templateIds: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: ANALYTICS_MAX_TEMPLATE_IDS,
    },
    metricTypes: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
    useWabaTimezone: { type: "boolean" },
  },
  required: ["startDate", "endDate", "templateIds", "metricTypes"],
  additionalProperties: false,
} satisfies DefineToolOptions["inputSchema"];

const bodyParameterSchema = z
  .string()
  .trim()
  .min(1)
  .max(SEND_MAX_BODY_PARAMETER_LENGTH);

export const templateSendInputSchema = z.object({
  phoneNumberId: phoneNumberIdSchema,
  recipient: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .transform((value, ctx) => {
      try {
        return normalizeRecipientE164(value);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Recipient must be a single E.164 phone number.",
        });
        return z.NEVER;
      }
    }),
  templateName: z.string().trim().min(1).max(MAX_TEMPLATE_NAME_LENGTH),
  languageCode: z.string().trim().min(2).max(MAX_LANGUAGE_CODE_LENGTH),
  bodyParameters: z
    .array(bodyParameterSchema)
    .max(SEND_MAX_BODY_PARAMETERS)
    .optional()
    .default([]),
});

export const templateSendInputJsonSchema = {
  type: "object",
  properties: {
    phoneNumberId: { type: "string" },
    recipient: {
      type: "string",
      description:
        "Single E.164 recipient. Must be listed in OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS (host-verified opt-in).",
    },
    templateName: { type: "string" },
    languageCode: { type: "string", description: "Template locale code." },
    bodyParameters: {
      type: "array",
      items: { type: "string" },
      maxItems: SEND_MAX_BODY_PARAMETERS,
      description: "Body text placeholders only (no header media or buttons).",
    },
  },
  required: ["recipient", "templateName", "languageCode"],
  additionalProperties: false,
} satisfies DefineToolOptions["inputSchema"];
