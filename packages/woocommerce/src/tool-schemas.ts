import { z } from "zod";
import {
  LIST_MAX_LIMIT,
  MAX_PAGE_NUMBER,
  MAX_SEARCH_QUERY_LENGTH,
} from "./constants.js";
import { parseWoocommerceResourceId } from "./resource-id.js";
const pageSchema = z.number().int().min(1).max(MAX_PAGE_NUMBER);
const limitSchema = z.number().int().min(1).max(LIST_MAX_LIMIT);
const searchSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SEARCH_QUERY_LENGTH)
  .optional();
const isoDateSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^\d{4}-\d{2}-\d{2}/, "Date must be ISO-like.")
  .optional();
const productIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((value) => parseWoocommerceResourceId(value, "Product id"));
export const productListInputSchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: searchSchema,
    status: z.string().trim().min(1).max(32).optional(),
    categoryId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseWoocommerceResourceId(value, "Category id"))
      .optional(),
  })
  .strict();
export const productListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    search: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SEARCH_QUERY_LENGTH,
    },
    status: { type: "string", minLength: 1, maxLength: 32 },
    categoryId: { type: ["integer", "string"] },
  },
};
export const productGetInputSchema = z
  .object({ productId: productIdSchema })
  .strict();
export const productGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productId"],
  properties: { productId: { type: ["integer", "string"] } },
};
export const variationListInputSchema = z
  .object({
    productId: productIdSchema,
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
  })
  .strict();
export const variationListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productId"],
  properties: {
    productId: { type: ["integer", "string"] },
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
  },
};
export const variationGetInputSchema = z
  .object({
    productId: productIdSchema,
    variationId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseWoocommerceResourceId(value, "Variation id")),
  })
  .strict();
export const variationGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productId", "variationId"],
  properties: {
    productId: { type: ["integer", "string"] },
    variationId: { type: ["integer", "string"] },
  },
};
export const categoryListInputSchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: searchSchema,
    parentId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseWoocommerceResourceId(value, "Parent id"))
      .optional(),
  })
  .strict();
export const categoryListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    search: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SEARCH_QUERY_LENGTH,
    },
    parentId: { type: ["integer", "string"] },
  },
};
export const orderListInputSchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: searchSchema,
    status: z.string().trim().min(1).max(32).optional(),
    after: isoDateSchema,
    before: isoDateSchema,
  })
  .strict();
export const orderListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    search: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SEARCH_QUERY_LENGTH,
    },
    status: { type: "string", minLength: 1, maxLength: 32 },
    after: { type: "string", minLength: 1, maxLength: 64 },
    before: { type: "string", minLength: 1, maxLength: 64 },
  },
};
export const orderGetInputSchema = z
  .object({
    orderId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseWoocommerceResourceId(value, "Order id")),
  })
  .strict();
export const orderGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId"],
  properties: { orderId: { type: ["integer", "string"] } },
};
export const orderNoteListInputSchema = z
  .object({
    orderId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseWoocommerceResourceId(value, "Order id")),
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
  })
  .strict();
export const orderNoteListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId"],
  properties: {
    orderId: { type: ["integer", "string"] },
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
  },
};
export const productUpdateInputSchema = z
  .object({
    productId: productIdSchema,
    fields: z.record(z.string(), z.unknown()),
  })
  .strict();
export const productUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productId", "fields"],
  properties: {
    productId: { type: ["integer", "string"] },
    fields: { type: "object", additionalProperties: true },
  },
};
export const orderStatusUpdateInputSchema = z
  .object({
    orderId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseWoocommerceResourceId(value, "Order id")),
    status: z.string().trim().min(1).max(32),
  })
  .strict();
export const orderStatusUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId", "status"],
  properties: {
    orderId: { type: ["integer", "string"] },
    status: { type: "string", minLength: 1, maxLength: 32 },
  },
};
