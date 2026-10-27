import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  EVENTS_MAX_DATETIME_RANGE_DAYS,
  EVENTS_MAX_PAGE_SIZE,
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_CURSOR_LENGTH,
} from "./constants.js";
import { parseKlaviyoResourceId } from "./resource-id.js";
import {
  ALLOWED_REPORT_STATISTICS,
  ALLOWED_REPORT_TIMEFRAME_KEYS,
  ALLOWED_CAMPAIGN_GROUP_BY,
  ALLOWED_FLOW_GROUP_BY,
} from "./reporting-allowlist.js";
import { REPORT_SEND_CHANNELS } from "./report-filter.js";

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

const resourceIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value, ctx) => {
      try {
        return parseKlaviyoResourceId(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

const limitSchema = (defaultLimit: number, maxLimit: number) =>
  z.number().int().min(1).max(maxLimit).optional().default(defaultLimit);

const ISO_DATETIME = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/,
    "Datetime must be ISO-8601.",
  );

export const accountGetInputSchema = z.object({}).strict();
export const accountGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies DefineToolOptions["inputSchema"];

export const campaignListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    pageCursor: cursorSchema,
  })
  .strict();

export const campaignListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const campaignGetInputSchema = z
  .object({
    campaignId: resourceIdSchema("Campaign ID"),
  })
  .strict();

export const campaignGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["campaignId"],
  properties: {
    campaignId: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const flowListInputSchema = campaignListInputSchema;
export const flowListInputJsonSchema = campaignListInputJsonSchema;

export const flowGetInputSchema = z
  .object({
    flowId: resourceIdSchema("Flow ID"),
  })
  .strict();

export const flowGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["flowId"],
  properties: {
    flowId: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const metricListInputSchema = campaignListInputSchema;
export const metricListInputJsonSchema = campaignListInputJsonSchema;

export const metricGetInputSchema = z
  .object({
    metricId: resourceIdSchema("Metric ID"),
  })
  .strict();

export const metricGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["metricId"],
  properties: {
    metricId: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

function validateEventsDatetimeRange(start: string, end: string): boolean {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return false;
  }
  const days = (endMs - startMs) / 86_400_000;
  return days <= EVENTS_MAX_DATETIME_RANGE_DAYS;
}

export function buildEventsDatetimeFilter(start: string, end: string): string {
  return `greater-or-equal(datetime,${start}),less-than(datetime,${end})`;
}

export const eventListInputSchema = z
  .object({
    startDatetime: ISO_DATETIME,
    endDatetime: ISO_DATETIME,
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, EVENTS_MAX_PAGE_SIZE),
    pageCursor: cursorSchema,
  })
  .strict()
  .refine(
    (value) =>
      validateEventsDatetimeRange(value.startDatetime, value.endDatetime),
    "Event datetime range is invalid or exceeds the maximum window.",
  );

export const eventListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startDatetime", "endDatetime"],
  properties: {
    startDatetime: { type: "string" },
    endDatetime: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: EVENTS_MAX_PAGE_SIZE },
    pageCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

const statisticsSchema = z
  .array(
    z
      .string()
      .trim()
      .refine(
        (value) =>
          (ALLOWED_REPORT_STATISTICS as readonly string[]).includes(value),
        "Statistic is not allowlisted.",
      ),
  )
  .min(1)
  .max(32);

const timeframeKeySchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      (ALLOWED_REPORT_TIMEFRAME_KEYS as readonly string[]).includes(value),
    "Timeframe key is not allowlisted.",
  )
  .optional();

const conversionMetricIdSchema = resourceIdSchema("Conversion metric ID");

const optionalResourceIdSchema = (label: string) =>
  resourceIdSchema(label).optional();

const filterTextSchema = z.string().trim().min(1).max(200);

const tagIdListSchema = z
  .array(resourceIdSchema("Tag ID"))
  .min(1)
  .max(100)
  .optional();

const tagNameListSchema = z.array(filterTextSchema).min(1).max(100).optional();

const sendChannelsSchema = z
  .array(
    z.enum(REPORT_SEND_CHANNELS, {
      message: "Report filter send channel is not supported.",
    }),
  )
  .min(1)
  .max(REPORT_SEND_CHANNELS.length)
  .optional();

export const campaignReportFilterInputSchema = z
  .object({
    sendChannels: sendChannelsSchema,
    campaignId: optionalResourceIdSchema("Campaign ID"),
    campaignMessageId: optionalResourceIdSchema("Campaign message ID"),
    campaignMessageName: filterTextSchema.optional(),
    variation: filterTextSchema.optional(),
    variationName: filterTextSchema.optional(),
    textMessageFormat: filterTextSchema.optional(),
    tagIds: tagIdListSchema,
    tagIdsMatchAll: z.boolean().optional(),
    tagNames: tagNameListSchema,
    tagNamesMatchAll: z.boolean().optional(),
  })
  .strict()
  .optional();

export const flowReportFilterInputSchema = z
  .object({
    sendChannels: sendChannelsSchema,
    flowId: optionalResourceIdSchema("Flow ID"),
    flowName: filterTextSchema.optional(),
    flowMessageId: optionalResourceIdSchema("Flow message ID"),
    flowMessageName: filterTextSchema.optional(),
    variation: filterTextSchema.optional(),
    variationName: filterTextSchema.optional(),
    textMessageFormat: filterTextSchema.optional(),
    tagIds: tagIdListSchema,
    tagIdsMatchAll: z.boolean().optional(),
    tagNames: tagNameListSchema,
    tagNamesMatchAll: z.boolean().optional(),
  })
  .strict()
  .optional();

const campaignReportFilterJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sendChannels: {
      type: "array",
      minItems: 1,
      maxItems: REPORT_SEND_CHANNELS.length,
      items: {
        type: "string",
        enum: [...REPORT_SEND_CHANNELS],
      },
    },
    campaignId: { type: "string", minLength: 1, maxLength: 64 },
    campaignMessageId: { type: "string", minLength: 1, maxLength: 64 },
    campaignMessageName: { type: "string", minLength: 1, maxLength: 200 },
    variation: { type: "string", minLength: 1, maxLength: 200 },
    variationName: { type: "string", minLength: 1, maxLength: 200 },
    textMessageFormat: { type: "string", minLength: 1, maxLength: 200 },
    tagIds: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: { type: "string", minLength: 1, maxLength: 64 },
    },
    tagIdsMatchAll: { type: "boolean" },
    tagNames: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: { type: "string", minLength: 1, maxLength: 200 },
    },
    tagNamesMatchAll: { type: "boolean" },
  },
} as const;

const flowReportFilterJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sendChannels: {
      type: "array",
      minItems: 1,
      maxItems: REPORT_SEND_CHANNELS.length,
      items: {
        type: "string",
        enum: [...REPORT_SEND_CHANNELS],
      },
    },
    flowId: { type: "string", minLength: 1, maxLength: 64 },
    flowName: { type: "string", minLength: 1, maxLength: 200 },
    flowMessageId: { type: "string", minLength: 1, maxLength: 64 },
    flowMessageName: { type: "string", minLength: 1, maxLength: 200 },
    variation: { type: "string", minLength: 1, maxLength: 200 },
    variationName: { type: "string", minLength: 1, maxLength: 200 },
    textMessageFormat: { type: "string", minLength: 1, maxLength: 200 },
    tagIds: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: { type: "string", minLength: 1, maxLength: 64 },
    },
    tagIdsMatchAll: { type: "boolean" },
    tagNames: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: { type: "string", minLength: 1, maxLength: 200 },
    },
    tagNamesMatchAll: { type: "boolean" },
  },
} as const;

export const reportCampaignInputSchema = z
  .object({
    statistics: statisticsSchema,
    timeframeKey: timeframeKeySchema,
    start: ISO_DATETIME.optional(),
    end: ISO_DATETIME.optional(),
    conversionMetricId: conversionMetricIdSchema,
    groupBy: z
      .array(
        z
          .string()
          .trim()
          .refine(
            (value) =>
              (ALLOWED_CAMPAIGN_GROUP_BY as readonly string[]).includes(value),
            "groupBy dimension is not allowlisted.",
          ),
      )
      .max(6)
      .optional(),
    filter: campaignReportFilterInputSchema,
    pageCursor: cursorSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasKey =
      value.timeframeKey !== undefined && value.timeframeKey.length > 0;
    const hasStart = value.start !== undefined;
    const hasEnd = value.end !== undefined;
    if (hasKey && (hasStart || hasEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either timeframeKey or start/end.",
      });
    }
    if (!hasKey && !(hasStart && hasEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "timeframeKey or both start and end are required.",
      });
    }
  });

export const reportCampaignInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["statistics", "conversionMetricId"],
  properties: {
    statistics: {
      type: "array",
      minItems: 1,
      maxItems: 32,
      items: { type: "string" },
    },
    timeframeKey: { type: "string" },
    start: { type: "string" },
    end: { type: "string" },
    conversionMetricId: { type: "string", minLength: 1, maxLength: 64 },
    groupBy: { type: "array", items: { type: "string" }, maxItems: 6 },
    filter: campaignReportFilterJsonSchema,
    pageCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const reportFlowInputSchema = z
  .object({
    statistics: statisticsSchema,
    timeframeKey: timeframeKeySchema,
    start: ISO_DATETIME.optional(),
    end: ISO_DATETIME.optional(),
    conversionMetricId: conversionMetricIdSchema,
    groupBy: z
      .array(
        z
          .string()
          .trim()
          .refine(
            (value) =>
              (ALLOWED_FLOW_GROUP_BY as readonly string[]).includes(value),
            "groupBy dimension is not allowlisted.",
          ),
      )
      .max(6)
      .optional(),
    filter: flowReportFilterInputSchema,
    pageCursor: cursorSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasKey =
      value.timeframeKey !== undefined && value.timeframeKey.length > 0;
    const hasStart = value.start !== undefined;
    const hasEnd = value.end !== undefined;
    if (hasKey && (hasStart || hasEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either timeframeKey or start/end.",
      });
    }
    if (!hasKey && !(hasStart && hasEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "timeframeKey or both start and end are required.",
      });
    }
  });

export const reportFlowInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["statistics", "conversionMetricId"],
  properties: {
    statistics: {
      type: "array",
      minItems: 1,
      maxItems: 32,
      items: { type: "string" },
    },
    timeframeKey: { type: "string" },
    start: { type: "string" },
    end: { type: "string" },
    conversionMetricId: { type: "string", minLength: 1, maxLength: 64 },
    groupBy: { type: "array", items: { type: "string" }, maxItems: 6 },
    filter: flowReportFilterJsonSchema,
    pageCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];
