import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  MAX_DIMENSION_METRIC_NAME_LENGTH,
  MAX_PAGE_TOKEN_LENGTH,
  METADATA_DEFAULT_LIMIT,
  METADATA_MAX_LIMIT,
  METADATA_MAX_SEARCH_LENGTH,
  REALTIME_DEFAULT_LIMIT,
  REALTIME_MAX_DIMENSIONS,
  REALTIME_MAX_LIMIT,
  REALTIME_MAX_METRICS,
  REPORT_DEFAULT_LIMIT,
  REPORT_MAX_DATE_STRING_LENGTH,
  REPORT_MAX_DIMENSIONS,
  REPORT_MAX_FILTER_VALUES,
  REPORT_MAX_LIMIT,
  REPORT_MAX_METRICS,
  REPORT_MAX_ORDER_BYS,
} from "./constants.js";

export const GA4_FIELD_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,127}$/;

export const ga4DateSchema = z
  .string()
  .trim()
  .min(1)
  .max(REPORT_MAX_DATE_STRING_LENGTH)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value === "today" ||
      value === "yesterday" ||
      /^\d{1,3}daysAgo$/.test(value),
    "Invalid GA4 date expression.",
  );

const propertyIdSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    return typeof value === "number" ? String(value) : value.trim();
  });

const dimensionNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DIMENSION_METRIC_NAME_LENGTH)
  .regex(GA4_FIELD_NAME_PATTERN, "Invalid dimension name.");

const metricNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DIMENSION_METRIC_NAME_LENGTH)
  .regex(GA4_FIELD_NAME_PATTERN, "Invalid metric name.");

const stringFilterSchema = z
  .object({
    matchType: z.enum([
      "EXACT",
      "BEGINS_WITH",
      "ENDS_WITH",
      "CONTAINS",
      "FULL_REGEXP",
      "PARTIAL_REGEXP",
    ]),
    value: z.string().trim().min(1).max(256),
    caseSensitive: z.boolean().optional(),
  })
  .strict();

const inListFilterSchema = z
  .object({
    values: z
      .array(z.string().trim().min(1).max(256))
      .min(1)
      .max(REPORT_MAX_FILTER_VALUES),
    caseSensitive: z.boolean().optional(),
  })
  .strict();

export const dimensionFilterInputSchema = z
  .object({
    fieldName: dimensionNameSchema,
    stringFilter: stringFilterSchema.optional(),
    inListFilter: inListFilterSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.stringFilter !== undefined ? 1 : 0) +
        (value.inListFilter !== undefined ? 1 : 0) ===
      1,
    "Provide exactly one of stringFilter or inListFilter.",
  );

export const metricFilterInputSchema = z
  .object({
    fieldName: metricNameSchema,
    operation: z.enum([
      "EQUAL",
      "LESS_THAN",
      "LESS_THAN_OR_EQUAL",
      "GREATER_THAN",
      "GREATER_THAN_OR_EQUAL",
    ]),
    value: z.string().trim().min(1).max(64),
  })
  .strict();

export const orderByInputSchema = z
  .object({
    dimensionName: dimensionNameSchema.optional(),
    metricName: metricNameSchema.optional(),
    desc: z.boolean().optional().default(false),
  })
  .strict()
  .refine(
    (value) =>
      (value.dimensionName !== undefined ? 1 : 0) +
        (value.metricName !== undefined ? 1 : 0) ===
      1,
    "Provide exactly one of dimensionName or metricName.",
  );

export const propertyListInputSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_LIMIT)
      .optional()
      .default(LIST_DEFAULT_LIMIT),
    pageToken: z.string().trim().min(1).max(MAX_PAGE_TOKEN_LENGTH).optional(),
  })
  .strict();

export const propertyListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: LIST_MAX_LIMIT,
      description: "Maximum property summaries to return (default 50).",
    },
    pageToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_PAGE_TOKEN_LENGTH,
      description: "Admin API page token from a previous nextPageToken.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const propertyGetInputSchema = z
  .object({
    propertyId: propertyIdSchema,
  })
  .strict();

export const propertyGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    propertyId: {
      type: "string",
      description:
        "Numeric GA4 property ID. Optional when OSVA_CONNECTOR_GA4_PROPERTY_ID is set.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const metadataGetInputSchema = z
  .object({
    propertyId: propertyIdSchema,
    type: z.enum(["dimensions", "metrics", "all"]).optional().default("all"),
    search: z.string().trim().min(1).max(METADATA_MAX_SEARCH_LENGTH).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(METADATA_MAX_LIMIT)
      .optional()
      .default(METADATA_DEFAULT_LIMIT),
    offset: z.number().int().min(0).max(100_000).optional().default(0),
  })
  .strict();

export const metadataGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    propertyId: { type: "string" },
    type: {
      type: "string",
      enum: ["dimensions", "metrics", "all"],
      description: "Which metadata entries to return.",
    },
    search: {
      type: "string",
      minLength: 1,
      maxLength: METADATA_MAX_SEARCH_LENGTH,
      description:
        "Case-insensitive local filter applied after provider fetch.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: METADATA_MAX_LIMIT,
      description:
        "Local pagination page size (not Google server-side pagination).",
    },
    offset: {
      type: "integer",
      minimum: 0,
      description: "Local pagination offset.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const reportRunInputSchema = z
  .object({
    propertyId: propertyIdSchema,
    startDate: ga4DateSchema,
    endDate: ga4DateSchema,
    dimensions: z
      .array(dimensionNameSchema)
      .max(REPORT_MAX_DIMENSIONS)
      .optional()
      .default([]),
    metrics: z.array(metricNameSchema).min(1).max(REPORT_MAX_METRICS),
    limit: z
      .number()
      .int()
      .min(1)
      .max(REPORT_MAX_LIMIT)
      .optional()
      .default(REPORT_DEFAULT_LIMIT),
    offset: z.number().int().min(0).max(1_000_000).optional().default(0),
    dimensionFilter: dimensionFilterInputSchema.optional(),
    metricFilter: metricFilterInputSchema.optional(),
    orderBys: z.array(orderByInputSchema).max(REPORT_MAX_ORDER_BYS).optional(),
  })
  .strict();

export const reportRunInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startDate", "endDate", "metrics"],
  properties: {
    propertyId: { type: "string" },
    startDate: {
      type: "string",
      description: "YYYY-MM-DD, today, yesterday, or NdaysAgo.",
    },
    endDate: { type: "string" },
    dimensions: {
      type: "array",
      items: { type: "string" },
      maxItems: REPORT_MAX_DIMENSIONS,
    },
    metrics: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: REPORT_MAX_METRICS,
    },
    limit: { type: "integer", minimum: 1, maximum: REPORT_MAX_LIMIT },
    offset: { type: "integer", minimum: 0 },
    dimensionFilter: { type: "object" },
    metricFilter: { type: "object" },
    orderBys: {
      type: "array",
      maxItems: REPORT_MAX_ORDER_BYS,
      items: { type: "object" },
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const reportRealtimeInputSchema = z
  .object({
    propertyId: propertyIdSchema,
    dimensions: z
      .array(dimensionNameSchema)
      .max(REALTIME_MAX_DIMENSIONS)
      .optional(),
    metrics: z.array(metricNameSchema).max(REALTIME_MAX_METRICS).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(REALTIME_MAX_LIMIT)
      .optional()
      .default(REALTIME_DEFAULT_LIMIT),
  })
  .strict();

export const reportRealtimeInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    propertyId: { type: "string" },
    dimensions: {
      type: "array",
      items: { type: "string" },
      maxItems: REALTIME_MAX_DIMENSIONS,
    },
    metrics: {
      type: "array",
      items: { type: "string" },
      maxItems: REALTIME_MAX_METRICS,
      description: "Defaults to activeUsers when omitted.",
    },
    limit: { type: "integer", minimum: 1, maximum: REALTIME_MAX_LIMIT },
  },
} satisfies DefineToolOptions["inputSchema"];

export const ACQUISITION_CHANNEL_GROUPS = [
  "Organic Search",
  "Direct",
  "Referral",
  "Email",
  "Paid Search",
  "Paid Social",
  "Organic Social",
  "Display",
  "Affiliates",
  "Audio",
  "SMS",
  "Video",
  "Cross-network",
  "Unassigned",
] as const;

export const reportAcquisitionInputSchema = z
  .object({
    propertyId: propertyIdSchema,
    startDate: ga4DateSchema,
    endDate: ga4DateSchema,
    channelGrouping: z.enum(ACQUISITION_CHANNEL_GROUPS).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(REPORT_MAX_LIMIT)
      .optional()
      .default(REPORT_DEFAULT_LIMIT),
    offset: z.number().int().min(0).max(1_000_000).optional().default(0),
  })
  .strict();

export const reportAcquisitionInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startDate", "endDate"],
  properties: {
    propertyId: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    channelGrouping: {
      type: "string",
      enum: [...ACQUISITION_CHANNEL_GROUPS],
      description: "Optional filter on sessionDefaultChannelGroup.",
    },
    limit: { type: "integer", minimum: 1, maximum: REPORT_MAX_LIMIT },
    offset: { type: "integer", minimum: 0 },
  },
} satisfies DefineToolOptions["inputSchema"];

export const reportEcommerceInputSchema = z
  .object({
    propertyId: propertyIdSchema,
    startDate: ga4DateSchema,
    endDate: ga4DateSchema,
    breakdown: z.enum(["overview", "product"]).optional().default("overview"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(REPORT_MAX_LIMIT)
      .optional()
      .default(REPORT_DEFAULT_LIMIT),
    offset: z.number().int().min(0).max(1_000_000).optional().default(0),
  })
  .strict();

export const reportEcommerceInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startDate", "endDate"],
  properties: {
    propertyId: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    breakdown: { type: "string", enum: ["overview", "product"] },
    limit: { type: "integer", minimum: 1, maximum: REPORT_MAX_LIMIT },
    offset: { type: "integer", minimum: 0 },
  },
} satisfies DefineToolOptions["inputSchema"];

export function buildDimensionFilterExpression(
  filter: z.infer<typeof dimensionFilterInputSchema>,
): unknown {
  const fieldName = filter.fieldName;
  if (filter.stringFilter !== undefined) {
    return {
      filter: {
        fieldName,
        stringFilter: filter.stringFilter,
      },
    };
  }
  return {
    filter: {
      fieldName,
      inListFilter: filter.inListFilter,
    },
  };
}

export function buildMetricFilterExpression(
  filter: z.infer<typeof metricFilterInputSchema>,
): unknown {
  return {
    filter: {
      fieldName: filter.fieldName,
      numericFilter: {
        operation: filter.operation,
        value: { int64Value: filter.value },
      },
    },
  };
}

export function buildOrderBys(
  orderBys: z.infer<typeof orderByInputSchema>[] | undefined,
): unknown[] | undefined {
  if (orderBys === undefined || orderBys.length === 0) {
    return undefined;
  }
  return orderBys.map((entry) => {
    if (entry.dimensionName !== undefined) {
      return {
        dimension: { dimensionName: entry.dimensionName },
        desc: entry.desc,
      };
    }
    return {
      metric: { metricName: entry.metricName },
      desc: entry.desc,
    };
  });
}
