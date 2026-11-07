import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  DEFAULT_NUM_RESULTS,
  MAX_DOMAIN_FILTER_ITEMS,
  MAX_DOMAIN_LENGTH,
  MAX_NUM_RESULTS,
  MAX_QUERY_LENGTH,
  MAX_USER_URL_LENGTH,
  MAX_USER_URLS,
  MIN_NUM_RESULTS,
} from "./constants.js";
import { validateUserHttpsUrl } from "./url-validation.js";

const domainFilterSchema = z
  .array(z.string().trim().min(1).max(MAX_DOMAIN_LENGTH))
  .max(MAX_DOMAIN_FILTER_ITEMS)
  .optional();

const querySchema = z.string().trim().min(1).max(MAX_QUERY_LENGTH);

const numResultsSchema = z
  .number()
  .int()
  .min(MIN_NUM_RESULTS)
  .max(MAX_NUM_RESULTS)
  .optional()
  .default(DEFAULT_NUM_RESULTS);

const searchTypeSchema = z
  .enum(["auto", "lite", "deep", "deep-lite"])
  .optional();

export const searchInputSchema = z
  .object({
    query: querySchema,
    numResults: numResultsSchema,
    type: searchTypeSchema,
    includeDomains: domainFilterSchema,
    excludeDomains: domainFilterSchema,
    category: z.string().trim().min(1).max(128).optional(),
    includeText: z.boolean().optional(),
    includeHighlights: z.boolean().optional(),
  })
  .strict();

export const searchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
    numResults: {
      type: "integer",
      minimum: MIN_NUM_RESULTS,
      maximum: MAX_NUM_RESULTS,
    },
    type: {
      type: "string",
      enum: ["auto", "lite", "deep", "deep-lite"],
    },
    includeDomains: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: MAX_DOMAIN_LENGTH },
      maxItems: MAX_DOMAIN_FILTER_ITEMS,
    },
    excludeDomains: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: MAX_DOMAIN_LENGTH },
      maxItems: MAX_DOMAIN_FILTER_ITEMS,
    },
    category: { type: "string", minLength: 1, maxLength: 128 },
    includeText: { type: "boolean" },
    includeHighlights: { type: "boolean" },
  },
} as const satisfies DefineToolOptions["inputSchema"];

const userUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_USER_URL_LENGTH)
  .transform((value, ctx) => {
    try {
      return validateUserHttpsUrl(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "URL is not allowed." });
      return z.NEVER;
    }
  });

export const contentsGetInputSchema = z
  .object({
    urls: z.array(userUrlSchema).min(1).max(MAX_USER_URLS),
    includeText: z.boolean().optional(),
    includeHighlights: z.boolean().optional(),
  })
  .strict();

export const contentsGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["urls"],
  properties: {
    urls: {
      type: "array",
      minItems: 1,
      maxItems: MAX_USER_URLS,
      items: { type: "string", minLength: 1, maxLength: MAX_USER_URL_LENGTH },
    },
    includeText: { type: "boolean" },
    includeHighlights: { type: "boolean" },
  },
} as const satisfies DefineToolOptions["inputSchema"];

const answerModelSchema = z
  .enum(["exa", "exa-pro", "exa-research", "exa-fast"])
  .optional();

export const answerInputSchema = z
  .object({
    query: querySchema,
    model: answerModelSchema,
    includeCitationText: z.boolean().optional(),
  })
  .strict();

export const answerInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
    model: {
      type: "string",
      enum: ["exa", "exa-pro", "exa-research", "exa-fast"],
    },
    includeCitationText: { type: "boolean" },
  },
} as const satisfies DefineToolOptions["inputSchema"];
