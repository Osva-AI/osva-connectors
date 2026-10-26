import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  GAQL_ALLOWED_RESOURCES,
  type GaqlAllowedResource,
} from "./gaql-allowlist.js";
import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  MAX_PAGE_TOKEN_LENGTH,
  REPORT_MAX_DATE_RANGE_DAYS,
  SEARCH_DEFAULT_PAGE_SIZE,
  SEARCH_MAX_PAGE_SIZE,
} from "./constants.js";
import { normalizeCustomerIdInput } from "./customer-id.js";

export const ADS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const adsDateSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(ADS_DATE_PATTERN, "Dates must be YYYY-MM-DD.");

const customerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value, ctx) => {
    try {
      return normalizeCustomerIdInput(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid customer ID." });
      return z.NEVER;
    }
  });

const campaignIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "campaignId must be numeric.")
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
  return days <= REPORT_MAX_DATE_RANGE_DAYS;
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

export const customerListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
  })
  .strict();

export const customerListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: LIST_MAX_LIMIT,
      description: "Maximum customer IDs to return.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const customerGetInputSchema = z
  .object({
    customerId: customerIdSchema,
  })
  .strict();

export const customerGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["customerId"],
  properties: {
    customerId: {
      type: "string",
      description: "10-digit Google Ads customer ID.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const campaignListInputSchema = z
  .object({
    customerId: customerIdSchema,
    startDate: adsDateSchema.optional(),
    endDate: adsDateSchema.optional(),
    limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    pageToken: z.string().trim().min(1).max(MAX_PAGE_TOKEN_LENGTH).optional(),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(SEARCH_MAX_PAGE_SIZE)
      .optional()
      .default(SEARCH_DEFAULT_PAGE_SIZE),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasStart = value.startDate !== undefined;
    const hasEnd = value.endDate !== undefined;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: "custom",
        message:
          "startDate and endDate must both be provided for date-bounded summaries.",
      });
      return;
    }
    if (
      hasStart &&
      hasEnd &&
      value.startDate !== undefined &&
      value.endDate !== undefined &&
      !validateDateRange(value.startDate, value.endDate)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Date range is invalid or exceeds the maximum reporting window.",
      });
    }
  });

export const campaignListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["customerId"],
  properties: {
    customerId: { type: "string" },
    startDate: {
      type: "string",
      description: "YYYY-MM-DD (optional summary window).",
    },
    endDate: {
      type: "string",
      description: "YYYY-MM-DD (optional summary window).",
    },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    pageToken: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: SEARCH_MAX_PAGE_SIZE },
  },
} satisfies DefineToolOptions["inputSchema"];

const performanceBaseSchema = z
  .object({
    customerId: customerIdSchema,
    startDate: adsDateSchema,
    endDate: adsDateSchema,
    campaignId: campaignIdSchema,
    limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    pageToken: z.string().trim().min(1).max(MAX_PAGE_TOKEN_LENGTH).optional(),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(SEARCH_MAX_PAGE_SIZE)
      .optional()
      .default(SEARCH_DEFAULT_PAGE_SIZE),
    currencyCode: z.string().trim().min(3).max(3).optional(),
  })
  .strict();

export const campaignPerformanceInputSchema = dateRangeRefine(
  performanceBaseSchema.omit({ campaignId: true }),
);
export const adGroupPerformanceInputSchema = dateRangeRefine(
  performanceBaseSchema,
);
export const keywordPerformanceInputSchema = dateRangeRefine(
  performanceBaseSchema,
);
export const searchTermPerformanceInputSchema = dateRangeRefine(
  performanceBaseSchema,
);
export const assetPerformanceInputSchema = dateRangeRefine(
  performanceBaseSchema.omit({ campaignId: true }),
);

function performanceJsonSchema(requiredCampaign: boolean) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["customerId", "startDate", "endDate"],
    properties: {
      customerId: { type: "string" },
      startDate: { type: "string" },
      endDate: { type: "string" },
      ...(requiredCampaign
        ? {
            campaignId: {
              type: "string",
              description: "Optional campaign filter.",
            },
          }
        : {}),
      limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
      pageToken: { type: "string" },
      pageSize: { type: "integer", minimum: 1, maximum: SEARCH_MAX_PAGE_SIZE },
      currencyCode: {
        type: "string",
        description:
          "Account currency for cost conversion labeling (e.g. USD).",
      },
    },
  } satisfies DefineToolOptions["inputSchema"];
}

export const campaignPerformanceInputJsonSchema = performanceJsonSchema(false);
export const adGroupPerformanceInputJsonSchema = performanceJsonSchema(true);
export const keywordPerformanceInputJsonSchema = performanceJsonSchema(true);
export const searchTermPerformanceInputJsonSchema = performanceJsonSchema(true);
export const assetPerformanceInputJsonSchema = performanceJsonSchema(false);

const gaqlResourceSchema = z.enum(
  GAQL_ALLOWED_RESOURCES as unknown as [
    GaqlAllowedResource,
    ...GaqlAllowedResource[],
  ],
);

export const reportQueryInputSchema = dateRangeRefine(
  z
    .object({
      customerId: customerIdSchema,
      startDate: adsDateSchema,
      endDate: adsDateSchema,
      resource: gaqlResourceSchema,
      attributes: z.array(z.string().trim().min(1).max(128)).min(1).max(15),
      metrics: z.array(z.string().trim().min(1).max(128)).max(10).optional(),
      segments: z
        .array(z.enum(["segments.date"]))
        .max(1)
        .optional()
        .default(["segments.date"]),
      pageToken: z.string().trim().min(1).max(MAX_PAGE_TOKEN_LENGTH).optional(),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(SEARCH_MAX_PAGE_SIZE)
        .optional()
        .default(SEARCH_DEFAULT_PAGE_SIZE),
      limit: limitSchema(LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
      currencyCode: z.string().trim().min(3).max(3).optional(),
    })
    .strict(),
);

export const reportQueryInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["customerId", "startDate", "endDate", "resource", "attributes"],
  properties: {
    customerId: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    resource: { type: "string", enum: [...GAQL_ALLOWED_RESOURCES] },
    attributes: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 15,
    },
    metrics: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    segments: {
      type: "array",
      items: { type: "string", enum: ["segments.date"] },
      maxItems: 1,
    },
    pageToken: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: SEARCH_MAX_PAGE_SIZE },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    currencyCode: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export function buildReportQueryFromStructuredInput(input: {
  resource: GaqlAllowedResource;
  attributes: readonly string[];
  metrics?: readonly string[];
  segments?: readonly string[];
  startDate: string;
  endDate: string;
  limit: number;
}): string {
  const fields = [
    ...input.attributes,
    ...(input.segments ?? []),
    ...(input.metrics ?? []),
  ];
  const uniqueFields = [...new Set(fields)];
  return `SELECT ${uniqueFields.join(", ")} FROM ${input.resource} WHERE segments.date BETWEEN '${input.startDate}' AND '${input.endDate}' LIMIT ${input.limit}`;
}
