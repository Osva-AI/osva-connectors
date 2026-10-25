import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  ANALYTICS_DEFAULT_ROW_LIMIT,
  ANALYTICS_MAX_DIMENSION_FILTER_GROUPS,
  ANALYTICS_MAX_DIMENSIONS,
  ANALYTICS_MAX_FILTERS_PER_GROUP,
  ANALYTICS_MAX_REPORTING_DAYS,
  ANALYTICS_MAX_ROW_LIMIT,
  ANALYTICS_MAX_START_ROW,
  ANALYTICS_MAX_DATE_STRING_LENGTH,
  MAX_INSPECTION_URL_LENGTH,
  MAX_LANGUAGE_CODE_LENGTH,
  MAX_SITEMAP_URL_LENGTH,
  PRESET_DEFAULT_LIMIT,
  PRESET_MAX_LIMIT,
} from "./constants.js";
import type {
  GscSearchAnalyticsDimensionFilter,
  GscSearchAnalyticsDimensionFilterGroup,
} from "./gsc-client.js";

export const GSC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const gscDateSchema = z
  .string()
  .trim()
  .min(1)
  .max(ANALYTICS_MAX_DATE_STRING_LENGTH)
  .regex(GSC_DATE_PATTERN, "Search Analytics dates must be YYYY-MM-DD.");

const siteUrlSchema = z.string().trim().min(1).max(2048).optional();

const searchAnalyticsDimensionSchema = z.enum([
  "date",
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
]);

const searchAnalyticsTypeSchema = z.enum([
  "web",
  "image",
  "video",
  "news",
  "googleNews",
  "discover",
]);

const aggregationTypeSchema = z.enum(["auto", "byPage", "byProperty"]);

const dataStateSchema = z.enum(["final", "all", "hourly_all"]);

const dimensionFilterOperatorSchema = z.enum([
  "equals",
  "contains",
  "notContains",
  "notEquals",
  "includingRegex",
  "excludingRegex",
]);

const dimensionFilterSchema = z
  .object({
    dimension: searchAnalyticsDimensionSchema,
    operator: dimensionFilterOperatorSchema,
    expression: z.string().trim().min(1).max(256),
  })
  .strict();

const dimensionFilterGroupSchema = z
  .object({
    groupType: z.enum(["and"]).optional().default("and"),
    filters: z
      .array(dimensionFilterSchema)
      .min(1)
      .max(ANALYTICS_MAX_FILTERS_PER_GROUP),
  })
  .strict();

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
  return days <= ANALYTICS_MAX_REPORTING_DAYS;
}

const httpUrlSchema = (maxLength: number, label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, `${label} must be an http(s) URL.`);

export const propertyListInputSchema = z.object({}).strict();

export const propertyListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const propertyGetInputSchema = z
  .object({
    siteUrl: siteUrlSchema,
  })
  .strict();

export const propertyGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    siteUrl: {
      type: "string",
      description: "URL-prefix or sc-domain property.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const performanceQueryInputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    startDate: gscDateSchema,
    endDate: gscDateSchema,
    dimensions: z
      .array(searchAnalyticsDimensionSchema)
      .min(1)
      .max(ANALYTICS_MAX_DIMENSIONS)
      .optional()
      .default(["query"]),
    type: searchAnalyticsTypeSchema.optional().default("web"),
    aggregationType: aggregationTypeSchema.optional(),
    dataState: dataStateSchema.optional(),
    dimensionFilterGroups: z
      .array(dimensionFilterGroupSchema)
      .max(ANALYTICS_MAX_DIMENSION_FILTER_GROUPS)
      .optional(),
    rowLimit: z
      .number()
      .int()
      .min(1)
      .max(ANALYTICS_MAX_ROW_LIMIT)
      .optional()
      .default(ANALYTICS_DEFAULT_ROW_LIMIT),
    startRow: z
      .number()
      .int()
      .min(0)
      .max(ANALYTICS_MAX_START_ROW)
      .optional()
      .default(0),
  })
  .strict()
  .refine(
    (value) => validateDateRange(value.startDate, value.endDate),
    "Invalid or out-of-range Search Analytics date range.",
  );

export const performanceQueryInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startDate", "endDate"],
  properties: {
    siteUrl: { type: "string" },
    startDate: { type: "string", description: "YYYY-MM-DD" },
    endDate: { type: "string", description: "YYYY-MM-DD" },
    dimensions: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "date",
          "query",
          "page",
          "country",
          "device",
          "searchAppearance",
        ],
      },
    },
    type: {
      type: "string",
      enum: ["web", "image", "video", "news", "googleNews", "discover"],
    },
    aggregationType: {
      type: "string",
      enum: ["auto", "byPage", "byProperty"],
    },
    dataState: { type: "string", enum: ["final", "all", "hourly_all"] },
    dimensionFilterGroups: { type: "array" },
    rowLimit: { type: "number" },
    startRow: { type: "number" },
  },
} satisfies DefineToolOptions["inputSchema"];

const presetFiltersSchema = z
  .object({
    device: z.enum(["DESKTOP", "MOBILE", "TABLET"]).optional(),
    country: z
      .string()
      .trim()
      .min(2)
      .max(3)
      .regex(/^[a-z]{2,3}$/i, "Country must be ISO 3166-1 alpha-2/3.")
      .optional(),
    page: z.string().trim().min(1).max(2048).optional(),
  })
  .strict();

export const performancePagesInputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    startDate: gscDateSchema,
    endDate: gscDateSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(PRESET_MAX_LIMIT)
      .optional()
      .default(PRESET_DEFAULT_LIMIT),
    startRow: z
      .number()
      .int()
      .min(0)
      .max(ANALYTICS_MAX_START_ROW)
      .optional()
      .default(0),
    device: presetFiltersSchema.shape.device,
    country: presetFiltersSchema.shape.country,
  })
  .strict()
  .refine(
    (value) => validateDateRange(value.startDate, value.endDate),
    "Invalid or out-of-range Search Analytics date range.",
  );

export const performancePagesInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startDate", "endDate"],
  properties: {
    siteUrl: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    limit: { type: "number" },
    startRow: { type: "number" },
    device: { type: "string", enum: ["DESKTOP", "MOBILE", "TABLET"] },
    country: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const performanceQueriesInputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    startDate: gscDateSchema,
    endDate: gscDateSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(PRESET_MAX_LIMIT)
      .optional()
      .default(PRESET_DEFAULT_LIMIT),
    startRow: z
      .number()
      .int()
      .min(0)
      .max(ANALYTICS_MAX_START_ROW)
      .optional()
      .default(0),
    device: presetFiltersSchema.shape.device,
    country: presetFiltersSchema.shape.country,
    page: z.string().trim().min(1).max(2048).optional(),
  })
  .strict()
  .refine(
    (value) => validateDateRange(value.startDate, value.endDate),
    "Invalid or out-of-range Search Analytics date range.",
  );

export const performanceQueriesInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startDate", "endDate"],
  properties: {
    siteUrl: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    limit: { type: "number" },
    startRow: { type: "number" },
    device: { type: "string", enum: ["DESKTOP", "MOBILE", "TABLET"] },
    country: { type: "string" },
    page: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const sitemapListInputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    sitemapIndex: httpUrlSchema(
      MAX_SITEMAP_URL_LENGTH,
      "sitemapIndex",
    ).optional(),
  })
  .strict();

export const sitemapListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    siteUrl: { type: "string" },
    sitemapIndex: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const sitemapGetInputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    sitemapUrl: httpUrlSchema(MAX_SITEMAP_URL_LENGTH, "sitemapUrl"),
  })
  .strict();

export const sitemapGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sitemapUrl"],
  properties: {
    siteUrl: { type: "string" },
    sitemapUrl: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const urlInspectInputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    inspectionUrl: httpUrlSchema(MAX_INSPECTION_URL_LENGTH, "inspectionUrl"),
    languageCode: z
      .string()
      .trim()
      .min(2)
      .max(MAX_LANGUAGE_CODE_LENGTH)
      .optional(),
  })
  .strict();

export const urlInspectInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["inspectionUrl"],
  properties: {
    siteUrl: { type: "string" },
    inspectionUrl: { type: "string" },
    languageCode: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export function buildPresetDimensionFilterGroups(options: {
  readonly device?: "DESKTOP" | "MOBILE" | "TABLET";
  readonly country?: string;
  readonly page?: string;
}): GscSearchAnalyticsDimensionFilterGroup[] | undefined {
  const filters: GscSearchAnalyticsDimensionFilter[] = [];
  if (options.device !== undefined) {
    filters.push({
      dimension: "device",
      operator: "equals",
      expression: options.device,
    });
  }
  if (options.country !== undefined) {
    filters.push({
      dimension: "country",
      operator: "equals",
      expression: options.country.toLowerCase(),
    });
  }
  if (options.page !== undefined) {
    filters.push({
      dimension: "page",
      operator: "equals",
      expression: options.page,
    });
  }
  if (filters.length === 0) {
    return undefined;
  }
  return [{ groupType: "and", filters }];
}

export function buildDimensionFilterGroupsFromInput(
  groups: z.infer<typeof dimensionFilterGroupSchema>[] | undefined,
): GscSearchAnalyticsDimensionFilterGroup[] | undefined {
  if (groups === undefined || groups.length === 0) {
    return undefined;
  }
  return groups.map((group) => ({
    groupType: group.groupType,
    filters: group.filters.map((filter) => ({
      dimension: filter.dimension,
      operator: filter.operator,
      expression: filter.expression,
    })),
  }));
}
