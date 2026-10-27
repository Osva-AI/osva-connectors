import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import { normalizeAccountIdInput } from "./account-id.js";
import {
  ALLOWED_ATTRIBUTION_WINDOWS,
  ALLOWED_BREAKDOWNS,
  validateBreakdownSelection,
  type AllowedBreakdown,
} from "./insights-allowlist.js";
import {
  INSIGHTS_MAX_DATE_RANGE_DAYS,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  MAX_CURSOR_LENGTH,
} from "./constants.js";

export const META_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const metaDateSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(META_DATE_PATTERN, "Dates must be YYYY-MM-DD.");

const accountIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((value, ctx) => {
    try {
      return normalizeAccountIdInput(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid ad account ID." });
      return z.NEVER;
    }
  });

const entityIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "ID must be numeric.")
  .max(32);

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
  return days <= INSIGHTS_MAX_DATE_RANGE_DAYS;
}

const dateRangeRefine = <T extends { startDate: string; endDate: string }>(
  schema: z.ZodType<T>,
) =>
  schema.refine(
    (value) => validateDateRange(value.startDate, value.endDate),
    "Date range is invalid or exceeds the maximum reporting window.",
  );

const limitSchema = (defaultLimit: number, maxLimit: number) =>
  z.number().int().min(1).max(maxLimit).optional().default(defaultLimit);

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

const attributionWindowsSchema = z
  .array(
    z
      .string()
      .trim()
      .refine(
        (value) =>
          (ALLOWED_ATTRIBUTION_WINDOWS as readonly string[]).includes(value),
        "Unsupported attribution window.",
      ),
  )
  .max(8)
  .optional();

export const adAccountListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    cursor: cursorSchema,
  })
  .strict();

export const adAccountListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: LIST_MAX_LIMIT,
      description: "Maximum ad accounts to return.",
    },
    cursor: {
      type: "string",
      description: "Graph API after-cursor from a prior response.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const adAccountGetInputSchema = z
  .object({
    accountId: accountIdSchema,
  })
  .strict();

export const adAccountGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accountId"],
  properties: {
    accountId: {
      type: "string",
      description: "Meta ad account ID (numeric or act_ prefix).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const campaignListInputSchema = z
  .object({
    accountId: accountIdSchema,
    limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    cursor: cursorSchema,
  })
  .strict();

export const campaignListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accountId"],
  properties: {
    accountId: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    cursor: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const adSetListInputSchema = z
  .object({
    accountId: accountIdSchema,
    campaignId: entityIdSchema.optional(),
    limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    cursor: cursorSchema,
  })
  .strict();

export const adSetListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accountId"],
  properties: {
    accountId: { type: "string" },
    campaignId: {
      type: "string",
      description: "Optional campaign filter (numeric ID).",
    },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    cursor: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const adListInputSchema = z
  .object({
    accountId: accountIdSchema,
    limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    cursor: cursorSchema,
  })
  .strict();

export const adListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accountId"],
  properties: {
    accountId: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    cursor: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

const insightsBaseSchema = z.object({
  accountId: accountIdSchema,
  startDate: metaDateSchema,
  endDate: metaDateSchema,
  limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
  cursor: cursorSchema,
  actionAttributionWindows: attributionWindowsSchema,
  useUnifiedAttributionSetting: z.boolean().optional(),
});

export const insightsAccountInputSchema = dateRangeRefine(
  insightsBaseSchema.strict(),
);

export const insightsCampaignInputSchema = dateRangeRefine(
  insightsBaseSchema.strict(),
);

export const insightsAdSetInputSchema = dateRangeRefine(
  insightsBaseSchema.strict(),
);

export const insightsAdInputSchema = dateRangeRefine(
  insightsBaseSchema.strict(),
);

const insightsJsonProperties = {
  accountId: { type: "string" },
  startDate: { type: "string", description: "Inclusive YYYY-MM-DD." },
  endDate: { type: "string", description: "Inclusive YYYY-MM-DD." },
  limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
  cursor: { type: "string" },
  actionAttributionWindows: {
    type: "array",
    items: { type: "string" },
    description: "Optional Meta action_attribution_windows override.",
  },
  useUnifiedAttributionSetting: {
    type: "boolean",
    description: "When true, requests unified attribution setting.",
  },
} as const;

export const insightsAccountInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accountId", "startDate", "endDate"],
  properties: insightsJsonProperties,
} satisfies DefineToolOptions["inputSchema"];

export const insightsCampaignInputJsonSchema =
  insightsAccountInputJsonSchema satisfies DefineToolOptions["inputSchema"];

export const insightsAdSetInputJsonSchema =
  insightsAccountInputJsonSchema satisfies DefineToolOptions["inputSchema"];

export const insightsAdInputJsonSchema =
  insightsAccountInputJsonSchema satisfies DefineToolOptions["inputSchema"];

export const insightsBreakdownInputSchema = dateRangeRefine(
  insightsBaseSchema
    .extend({
      breakdowns: z
        .array(z.enum(ALLOWED_BREAKDOWNS))
        .min(1)
        .max(2)
        .superRefine((value, ctx) => {
          try {
            validateBreakdownSelection(value as AllowedBreakdown[]);
          } catch {
            ctx.addIssue({
              code: "custom",
              message: "Breakdown combination is not supported.",
            });
          }
        }),
      level: z
        .enum(["account", "campaign", "adset", "ad"])
        .optional()
        .default("account"),
    })
    .strict(),
);

export const insightsBreakdownInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accountId", "startDate", "endDate", "breakdowns"],
  properties: {
    ...insightsJsonProperties,
    breakdowns: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "string",
        enum: [...ALLOWED_BREAKDOWNS],
      },
    },
    level: {
      type: "string",
      enum: ["account", "campaign", "adset", "ad"],
      description: "Insights aggregation level (default account).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];
