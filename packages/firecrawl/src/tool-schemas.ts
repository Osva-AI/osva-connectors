import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import { parseCrawlId } from "./crawl-id.js";
import {
  CRAWL_DEFAULT_LIMIT,
  CRAWL_DEFAULT_MAX_DISCOVERY_DEPTH,
  CRAWL_MAX_DISCOVERY_DEPTH,
  CRAWL_MAX_LIMIT,
  MAX_CRAWL_STATUS_SKIP,
  MAP_DEFAULT_LIMIT,
  MAP_MAX_LIMIT,
  MAX_CRAWL_ID_LENGTH,
  MAX_MAP_SEARCH_FILTER_LENGTH,
  MAX_PAGINATION_NEXT_URL_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
} from "./constants.js";
import { parseHttpUrl } from "./http-url.js";
import { validateCrawlNextInput } from "./pagination.js";

const httpUrlInput = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((value, ctx) => {
      try {
        return parseHttpUrl(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

const crawlIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CRAWL_ID_LENGTH)
  .transform((value, ctx) => {
    try {
      return parseCrawlId(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid crawl job ID." });
      return z.NEVER;
    }
  });

const limitSchema = (defaultLimit: number, maxLimit: number) =>
  z.number().int().min(1).max(maxLimit).optional().default(defaultLimit);

const crawlNextSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PAGINATION_NEXT_URL_LENGTH)
  .transform((value, ctx) => {
    try {
      return validateCrawlNextInput(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Crawl pagination URL is not valid.",
      });
      return z.NEVER;
    }
  })
  .optional();

export const scrapeInputSchema = z
  .object({
    url: httpUrlInput("url"),
  })
  .strict();

export const scrapeInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1, maxLength: 2048 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const searchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH),
    limit: limitSchema(SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT),
  })
  .strict();

export const searchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: MAX_SEARCH_QUERY_LENGTH },
    limit: { type: "integer", minimum: 1, maximum: SEARCH_MAX_LIMIT },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const mapInputSchema = z
  .object({
    url: httpUrlInput("url"),
    limit: limitSchema(MAP_DEFAULT_LIMIT, MAP_MAX_LIMIT),
    search: z
      .string()
      .trim()
      .min(1)
      .max(MAX_MAP_SEARCH_FILTER_LENGTH)
      .optional(),
  })
  .strict();

export const mapInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1, maxLength: 2048 },
    limit: { type: "integer", minimum: 1, maximum: MAP_MAX_LIMIT },
    search: {
      type: "string",
      minLength: 1,
      maxLength: MAX_MAP_SEARCH_FILTER_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const crawlStartInputSchema = z
  .object({
    url: httpUrlInput("url"),
    limit: limitSchema(CRAWL_DEFAULT_LIMIT, CRAWL_MAX_LIMIT),
    maxDiscoveryDepth: z
      .number()
      .int()
      .min(0)
      .max(CRAWL_MAX_DISCOVERY_DEPTH)
      .optional()
      .default(CRAWL_DEFAULT_MAX_DISCOVERY_DEPTH),
  })
  .strict();

export const crawlStartInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1, maxLength: 2048 },
    limit: { type: "integer", minimum: 1, maximum: CRAWL_MAX_LIMIT },
    maxDiscoveryDepth: {
      type: "integer",
      minimum: 0,
      maximum: CRAWL_MAX_DISCOVERY_DEPTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const crawlStatusInputSchema = z
  .object({
    crawlId: crawlIdSchema,
    next: crawlNextSchema,
    skip: z.number().int().min(0).max(MAX_CRAWL_STATUS_SKIP).optional(),
  })
  .strict();

export const crawlStatusInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["crawlId"],
  properties: {
    crawlId: { type: "string", minLength: 1, maxLength: MAX_CRAWL_ID_LENGTH },
    next: {
      type: "string",
      minLength: 1,
      maxLength: MAX_PAGINATION_NEXT_URL_LENGTH,
    },
    skip: { type: "integer", minimum: 0, maximum: MAX_CRAWL_STATUS_SKIP },
  },
} as const satisfies DefineToolOptions["inputSchema"];
