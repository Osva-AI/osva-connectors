import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_CURSOR_LENGTH,
  MAX_FILTERS_PER_GROUP,
  MAX_SEARCH_FILTER_GROUPS,
} from "./constants.js";
import { crmObjectTypeSchema } from "./property-allowlist.js";
import { parseHubspotResourceId } from "./resource-id.js";
import { SEARCH_OPERATORS } from "./search-filter.js";

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

const resourceIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(32)
    .transform((value, ctx) => {
      try {
        return parseHubspotResourceId(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

const limitSchema = (defaultLimit: number, maxLimit: number) =>
  z.number().int().min(1).max(maxLimit).optional().default(defaultLimit);

const listInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    pageCursor: cursorSchema,
  })
  .strict();

export const listInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const contactListInputSchema = listInputSchema;
export const contactListInputJsonSchema = listInputJsonSchema;

export const contactGetInputSchema = z
  .object({
    contactId: resourceIdSchema("Contact ID"),
  })
  .strict();

export const contactGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contactId"],
  properties: {
    contactId: { type: "string", minLength: 1, maxLength: 32 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const companyListInputSchema = listInputSchema;
export const companyListInputJsonSchema = listInputJsonSchema;

export const companyGetInputSchema = z
  .object({
    companyId: resourceIdSchema("Company ID"),
  })
  .strict();

export const companyGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["companyId"],
  properties: {
    companyId: { type: "string", minLength: 1, maxLength: 32 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const dealListInputSchema = listInputSchema;
export const dealListInputJsonSchema = listInputJsonSchema;

export const dealGetInputSchema = z
  .object({
    dealId: resourceIdSchema("Deal ID"),
  })
  .strict();

export const dealGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dealId"],
  properties: {
    dealId: { type: "string", minLength: 1, maxLength: 32 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

const searchFilterSchema = z
  .object({
    propertyName: z.string().trim().min(1).max(64),
    operator: z.enum(SEARCH_OPERATORS),
    value: z.string().trim().min(1).max(512).optional(),
    values: z
      .array(z.string().trim().min(1).max(512))
      .min(1)
      .max(100)
      .optional(),
  })
  .strict();

const searchFilterGroupSchema = z
  .object({
    filters: z.array(searchFilterSchema).min(1).max(MAX_FILTERS_PER_GROUP),
  })
  .strict();

export const crmSearchInputSchema = z
  .object({
    objectType: crmObjectTypeSchema,
    filterGroups: z
      .array(searchFilterGroupSchema)
      .min(1)
      .max(MAX_SEARCH_FILTER_GROUPS),
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    pageCursor: cursorSchema,
  })
  .strict();

export const crmSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["objectType", "filterGroups"],
  properties: {
    objectType: { type: "string", enum: ["contacts", "companies", "deals"] },
    filterGroups: {
      type: "array",
      minItems: 1,
      maxItems: MAX_SEARCH_FILTER_GROUPS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["filters"],
        properties: {
          filters: {
            type: "array",
            minItems: 1,
            maxItems: MAX_FILTERS_PER_GROUP,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["propertyName", "operator"],
              properties: {
                propertyName: { type: "string", minLength: 1, maxLength: 64 },
                operator: {
                  type: "string",
                  enum: [...SEARCH_OPERATORS],
                },
                value: { type: "string", minLength: 1, maxLength: 512 },
                values: {
                  type: "array",
                  minItems: 1,
                  maxItems: 100,
                  items: { type: "string", minLength: 1, maxLength: 512 },
                },
              },
            },
          },
        },
      },
    },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const pipelineListInputSchema = z.object({}).strict();

export const pipelineListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies DefineToolOptions["inputSchema"];

export const ownerListInputSchema = listInputSchema;
export const ownerListInputJsonSchema = listInputJsonSchema;

export const associationListInputSchema = z
  .object({
    fromObjectType: crmObjectTypeSchema,
    fromObjectId: resourceIdSchema("From object ID"),
    toObjectType: crmObjectTypeSchema,
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    pageCursor: cursorSchema,
  })
  .strict();

export const associationListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fromObjectType", "fromObjectId", "toObjectType"],
  properties: {
    fromObjectType: {
      type: "string",
      enum: ["contacts", "companies", "deals"],
    },
    fromObjectId: { type: "string", minLength: 1, maxLength: 32 },
    toObjectType: { type: "string", enum: ["contacts", "companies", "deals"] },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageCursor: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];
