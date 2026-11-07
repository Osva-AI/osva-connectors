import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  COHORT_LIST_DEFAULT_LIMIT,
  COHORT_LIST_MAX_LIMIT,
  EVENT_TOP_DEFAULT_LIMIT,
  EVENT_TOP_MAX_LIMIT,
  MAX_DATE_STRING_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_EXPRESSION_LENGTH,
  MAX_LOOKBACK_DAYS,
  MAX_RESOURCE_ID_LENGTH,
  MAX_UNIT_LENGTH,
  RETENTION_DEFAULT_LIMIT,
  RETENTION_MAX_LIMIT,
  SEGMENTATION_DEFAULT_LIMIT,
  SEGMENTATION_MAX_LIMIT,
} from "./constants.js";
import { validateEventName } from "./event-name.js";
import { validateMixpanelExpression } from "./expression.js";

export const MIXPANEL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const mixpanelDateSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DATE_STRING_LENGTH)
  .regex(MIXPANEL_DATE_PATTERN, "Mixpanel dates must be YYYY-MM-DD.");

const resourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_RESOURCE_ID_LENGTH)
  .regex(/^\d+$/, "Resource ID must be numeric.");

const eventNameInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_EVENT_NAME_LENGTH)
  .transform((value, ctx) => {
    try {
      return validateEventName(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid event name." });
      return z.NEVER;
    }
  });

const expressionSchema = (label: "where" | "on") =>
  z
    .string()
    .trim()
    .min(1)
    .max(MAX_EXPRESSION_LENGTH)
    .transform((value, ctx) => {
      try {
        return validateMixpanelExpression(value, label);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: `Invalid ${label} expression.`,
        });
        return z.NEVER;
      }
    });

const unitSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_UNIT_LENGTH)
  .regex(/^[a-zA-Z]+$/, "Unit must be alphabetic.")
  .optional();

function validateDateRange(startDate: string, endDate: string): boolean {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return false;
  }
  if (end < start) {
    return false;
  }
  const days = (end - start) / 86_400_000 + 1;
  return days <= MAX_LOOKBACK_DAYS;
}

const datedRangeRefine = (data: { fromDate: string; toDate: string }) =>
  validateDateRange(data.fromDate, data.toDate);

export const reportGetInputSchema = z
  .object({
    bookmarkId: resourceIdSchema,
  })
  .strict();

export const reportGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bookmarkId: {
      type: "string",
      description: "Saved Insights bookmark ID.",
    },
  },
  required: ["bookmarkId"],
} satisfies DefineToolOptions["inputSchema"];

export const segmentationRunInputSchema = z
  .object({
    event: eventNameInputSchema,
    fromDate: mixpanelDateSchema,
    toDate: mixpanelDateSchema,
    unit: unitSchema,
    where: expressionSchema("where").optional(),
    on: expressionSchema("on").optional(),
    limit: z
      .number()
      .int()
      .positive()
      .max(SEGMENTATION_MAX_LIMIT)
      .optional()
      .default(SEGMENTATION_DEFAULT_LIMIT),
  })
  .strict()
  .refine(datedRangeRefine, {
    message: `Date range must not exceed ${MAX_LOOKBACK_DAYS} days.`,
  });

export const segmentationRunInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    event: { type: "string", description: "Event name to segment." },
    fromDate: {
      type: "string",
      description: "Inclusive start date YYYY-MM-DD.",
    },
    toDate: { type: "string", description: "Inclusive end date YYYY-MM-DD." },
    unit: {
      type: "string",
      description: "Optional bucket unit (for example day, week, month).",
    },
    where: {
      type: "string",
      description: "Optional Mixpanel where filter expression.",
    },
    on: {
      type: "string",
      description: "Optional Mixpanel on (property) expression.",
    },
    limit: {
      type: "number",
      description: `Max rows (default ${SEGMENTATION_DEFAULT_LIMIT}, max ${SEGMENTATION_MAX_LIMIT}).`,
    },
  },
  required: ["event", "fromDate", "toDate"],
} satisfies DefineToolOptions["inputSchema"];

export const funnelGetInputSchema = z
  .object({
    funnelId: resourceIdSchema,
    fromDate: mixpanelDateSchema,
    toDate: mixpanelDateSchema,
    unit: unitSchema,
    where: expressionSchema("where").optional(),
    on: expressionSchema("on").optional(),
  })
  .strict()
  .refine(datedRangeRefine, {
    message: `Date range must not exceed ${MAX_LOOKBACK_DAYS} days.`,
  });

export const funnelGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    funnelId: { type: "string", description: "Saved funnel ID." },
    fromDate: { type: "string" },
    toDate: { type: "string" },
    unit: { type: "string" },
    where: { type: "string" },
    on: { type: "string" },
  },
  required: ["funnelId", "fromDate", "toDate"],
} satisfies DefineToolOptions["inputSchema"];

export const retentionRunInputSchema = z
  .object({
    bornEvent: eventNameInputSchema,
    event: eventNameInputSchema,
    fromDate: mixpanelDateSchema,
    toDate: mixpanelDateSchema,
    retentionType: z.enum(["birth", "compounded"]).optional().default("birth"),
    unit: unitSchema,
    where: expressionSchema("where").optional(),
    on: expressionSchema("on").optional(),
    limit: z
      .number()
      .int()
      .positive()
      .max(RETENTION_MAX_LIMIT)
      .optional()
      .default(RETENTION_DEFAULT_LIMIT),
  })
  .strict()
  .refine(datedRangeRefine, {
    message: `Date range must not exceed ${MAX_LOOKBACK_DAYS} days.`,
  });

export const retentionRunInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bornEvent: { type: "string" },
    event: { type: "string" },
    fromDate: { type: "string" },
    toDate: { type: "string" },
    retentionType: { type: "string", enum: ["birth", "compounded"] },
    unit: { type: "string" },
    where: { type: "string" },
    on: { type: "string" },
    limit: { type: "number" },
  },
  required: ["bornEvent", "event", "fromDate", "toDate"],
} satisfies DefineToolOptions["inputSchema"];

export const cohortListInputSchema = z
  .object({
    limit: z
      .number()
      .int()
      .positive()
      .max(COHORT_LIST_MAX_LIMIT)
      .optional()
      .default(COHORT_LIST_DEFAULT_LIMIT),
  })
  .strict();

export const cohortListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "number",
      description: `Max cohorts (default ${COHORT_LIST_DEFAULT_LIMIT}, max ${COHORT_LIST_MAX_LIMIT}).`,
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const eventTopInputSchema = z
  .object({
    limit: z
      .number()
      .int()
      .positive()
      .max(EVENT_TOP_MAX_LIMIT)
      .optional()
      .default(EVENT_TOP_DEFAULT_LIMIT),
    type: z
      .enum(["general", "unique", "average"])
      .optional()
      .default("general"),
  })
  .strict();

export const eventTopInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "number",
      description: `Max events (default ${EVENT_TOP_DEFAULT_LIMIT}, max ${EVENT_TOP_MAX_LIMIT}).`,
    },
    type: {
      type: "string",
      enum: ["general", "unique", "average"],
    },
  },
} satisfies DefineToolOptions["inputSchema"];
