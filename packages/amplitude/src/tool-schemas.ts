import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import { assertBoundedDateRange } from "./bound-dates.js";
import { parseChartId } from "./chart-id.js";
import {
  MAX_FUNNEL_EVENTS,
  MAX_GROUP_BY_PROPERTIES,
  MAX_SEGMENT_PARAM_LENGTH,
} from "./constants.js";

const yyyymmddSchema = z
  .string()
  .trim()
  .regex(/^\d{8}$/, "Date must be formatted YYYYMMDD.");

const dateRangeRefine = <T extends { start: string; end: string }>(
  value: T,
  ctx: z.RefinementCtx,
): void => {
  try {
    assertBoundedDateRange(value.start, value.end);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid date range.";
    ctx.addIssue({ code: "custom", message });
  }
};

const groupByPropertySchema = z.string().trim().min(1).max(256);

const eventDefinitionSchema = z
  .object({
    event_type: z.string().trim().min(1).max(256),
  })
  .catchall(z.unknown());

const optionalSegmentSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SEGMENT_PARAM_LENGTH)
  .optional();

const intervalSchema = z
  .union([z.literal(1), z.literal(7), z.literal(30)])
  .optional();

export const eventListInputSchema = z.object({}).strict();
export const eventListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies DefineToolOptions["inputSchema"];

export const eventSegmentationInputSchema = z
  .object({
    start: yyyymmddSchema,
    end: yyyymmddSchema,
    event: eventDefinitionSchema,
    secondEvent: eventDefinitionSchema.optional(),
    metric: z.string().trim().min(1).max(64).optional(),
    interval: intervalSchema,
    groupBy: z
      .array(groupByPropertySchema)
      .max(MAX_GROUP_BY_PROPERTIES)
      .optional(),
    segment: optionalSegmentSchema,
    limit: z.number().int().min(1).max(20_000).optional(),
  })
  .strict()
  .superRefine(dateRangeRefine);

export const eventSegmentationInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["start", "end", "event"],
  properties: {
    start: { type: "string", pattern: "^\\d{8}$" },
    end: { type: "string", pattern: "^\\d{8}$" },
    event: {
      type: "object",
      additionalProperties: true,
      required: ["event_type"],
      properties: {
        event_type: { type: "string", minLength: 1, maxLength: 256 },
      },
    },
    secondEvent: {
      type: "object",
      additionalProperties: true,
      required: ["event_type"],
      properties: {
        event_type: { type: "string", minLength: 1, maxLength: 256 },
      },
    },
    metric: { type: "string", minLength: 1, maxLength: 64 },
    interval: { type: "integer", enum: [1, 7, 30] },
    groupBy: {
      type: "array",
      maxItems: MAX_GROUP_BY_PROPERTIES,
      items: { type: "string", minLength: 1, maxLength: 256 },
    },
    segment: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SEGMENT_PARAM_LENGTH,
    },
    limit: { type: "integer", minimum: 1, maximum: 20_000 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const funnelRunInputSchema = z
  .object({
    start: yyyymmddSchema,
    end: yyyymmddSchema,
    events: z.array(eventDefinitionSchema).min(1).max(MAX_FUNNEL_EVENTS),
    mode: z.enum(["ordered", "unordered", "sequential"]).optional(),
    userType: z.enum(["new", "active"]).optional(),
    interval: intervalSchema,
    groupBy: groupByPropertySchema.optional(),
    segment: optionalSegmentSchema,
  })
  .strict()
  .superRefine(dateRangeRefine);

export const funnelRunInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["start", "end", "events"],
  properties: {
    start: { type: "string", pattern: "^\\d{8}$" },
    end: { type: "string", pattern: "^\\d{8}$" },
    events: {
      type: "array",
      minItems: 1,
      maxItems: MAX_FUNNEL_EVENTS,
      items: {
        type: "object",
        additionalProperties: true,
        required: ["event_type"],
        properties: {
          event_type: { type: "string", minLength: 1, maxLength: 256 },
        },
      },
    },
    mode: { type: "string", enum: ["ordered", "unordered", "sequential"] },
    userType: { type: "string", enum: ["new", "active"] },
    interval: { type: "integer", enum: [1, 7, 30] },
    groupBy: { type: "string", minLength: 1, maxLength: 256 },
    segment: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SEGMENT_PARAM_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const retentionRunInputSchema = z
  .object({
    start: yyyymmddSchema,
    end: yyyymmddSchema,
    startEvent: eventDefinitionSchema,
    returnEvent: eventDefinitionSchema,
    retentionMode: z
      .enum(["nday", "rolling", "bracket", "nday_or_before"])
      .optional(),
    interval: intervalSchema,
    groupBy: groupByPropertySchema.optional(),
    segment: optionalSegmentSchema,
  })
  .strict()
  .superRefine(dateRangeRefine);

export const retentionRunInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["start", "end", "startEvent", "returnEvent"],
  properties: {
    start: { type: "string", pattern: "^\\d{8}$" },
    end: { type: "string", pattern: "^\\d{8}$" },
    startEvent: {
      type: "object",
      additionalProperties: true,
      required: ["event_type"],
      properties: {
        event_type: { type: "string", minLength: 1, maxLength: 256 },
      },
    },
    returnEvent: {
      type: "object",
      additionalProperties: true,
      required: ["event_type"],
      properties: {
        event_type: { type: "string", minLength: 1, maxLength: 256 },
      },
    },
    retentionMode: {
      type: "string",
      enum: ["nday", "rolling", "bracket", "nday_or_before"],
    },
    interval: { type: "integer", enum: [1, 7, 30] },
    groupBy: { type: "string", minLength: 1, maxLength: 256 },
    segment: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SEGMENT_PARAM_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const userActiveInputSchema = z
  .object({
    start: yyyymmddSchema,
    end: yyyymmddSchema,
    userMetric: z.enum(["new", "active"]).optional(),
    interval: intervalSchema,
    groupBy: groupByPropertySchema.optional(),
    segment: optionalSegmentSchema,
  })
  .strict()
  .superRefine(dateRangeRefine);

export const userActiveInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["start", "end"],
  properties: {
    start: { type: "string", pattern: "^\\d{8}$" },
    end: { type: "string", pattern: "^\\d{8}$" },
    userMetric: { type: "string", enum: ["new", "active"] },
    interval: { type: "integer", enum: [1, 7, 30] },
    groupBy: { type: "string", minLength: 1, maxLength: 256 },
    segment: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SEGMENT_PARAM_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const chartGetInputSchema = z
  .object({
    chartId: z
      .string()
      .trim()
      .min(1)
      .transform((value, ctx) => {
        try {
          return parseChartId(value);
        } catch {
          ctx.addIssue({ code: "custom", message: "Chart ID is invalid." });
          return z.NEVER;
        }
      }),
  })
  .strict();

export const chartGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["chartId"],
  properties: {
    chartId: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const sessionAverageInputSchema = z
  .object({
    start: yyyymmddSchema,
    end: yyyymmddSchema,
  })
  .strict()
  .superRefine(dateRangeRefine);

export const sessionAverageInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["start", "end"],
  properties: {
    start: { type: "string", pattern: "^\\d{8}$" },
    end: { type: "string", pattern: "^\\d{8}$" },
  },
} as const satisfies DefineToolOptions["inputSchema"];
