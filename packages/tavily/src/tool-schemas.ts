import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  CRAWL_DEFAULT_LIMIT,
  CRAWL_DEFAULT_MAX_BREADTH,
  CRAWL_DEFAULT_MAX_DEPTH,
  CRAWL_MAX_BREADTH,
  CRAWL_MAX_DEPTH,
  CRAWL_MAX_LIMIT,
  EXTRACT_MAX_URLS,
  MAX_CRAWL_INSTRUCTIONS_LENGTH,
  MAX_QUERY_LENGTH,
  SEARCH_DEFAULT_MAX_RESULTS,
  SEARCH_MAX_RESULTS,
} from "./constants.js";
import { parseHttpsTargetUrl } from "./url-target.js";

const targetUrlSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((value, ctx) => {
      try {
        return parseHttpsTargetUrl(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

export const searchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(SEARCH_MAX_RESULTS)
      .optional()
      .default(SEARCH_DEFAULT_MAX_RESULTS),
    searchDepth: z.enum(["basic", "fast", "ultra-fast"]).optional(),
    topic: z.enum(["general", "news", "finance"]).optional(),
    includeAnswer: z.boolean().optional(),
  })
  .strict();

export const searchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
    maxResults: {
      type: "integer",
      minimum: 1,
      maximum: SEARCH_MAX_RESULTS,
    },
    searchDepth: {
      type: "string",
      enum: ["basic", "fast", "ultra-fast"],
    },
    topic: { type: "string", enum: ["general", "news", "finance"] },
    includeAnswer: { type: "boolean" },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const extractInputSchema = z
  .object({
    urls: z.array(targetUrlSchema("URL")).min(1).max(EXTRACT_MAX_URLS),
    extractDepth: z.enum(["basic", "advanced"]).optional(),
    format: z.enum(["markdown", "text"]).optional(),
  })
  .strict();

export const extractInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["urls"],
  properties: {
    urls: {
      type: "array",
      minItems: 1,
      maxItems: EXTRACT_MAX_URLS,
      items: { type: "string", minLength: 1 },
    },
    extractDepth: { type: "string", enum: ["basic", "advanced"] },
    format: { type: "string", enum: ["markdown", "text"] },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const crawlInputSchema = z
  .object({
    url: targetUrlSchema("crawl URL"),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(CRAWL_MAX_DEPTH)
      .optional()
      .default(CRAWL_DEFAULT_MAX_DEPTH),
    limit: z
      .number()
      .int()
      .min(1)
      .max(CRAWL_MAX_LIMIT)
      .optional()
      .default(CRAWL_DEFAULT_LIMIT),
    maxBreadth: z
      .number()
      .int()
      .min(1)
      .max(CRAWL_MAX_BREADTH)
      .optional()
      .default(CRAWL_DEFAULT_MAX_BREADTH),
    instructions: z
      .string()
      .trim()
      .min(1)
      .max(MAX_CRAWL_INSTRUCTIONS_LENGTH)
      .optional(),
    format: z.enum(["markdown", "text"]).optional(),
  })
  .strict();

export const crawlInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1 },
    maxDepth: { type: "integer", minimum: 1, maximum: CRAWL_MAX_DEPTH },
    limit: { type: "integer", minimum: 1, maximum: CRAWL_MAX_LIMIT },
    maxBreadth: { type: "integer", minimum: 1, maximum: CRAWL_MAX_BREADTH },
    instructions: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CRAWL_INSTRUCTIONS_LENGTH,
    },
    format: { type: "string", enum: ["markdown", "text"] },
  },
} as const satisfies DefineToolOptions["inputSchema"];
