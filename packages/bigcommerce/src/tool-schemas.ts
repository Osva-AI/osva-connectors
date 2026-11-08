import { z } from "zod";
import {
  LIST_MAX_LIMIT,
  MAX_PAGE_NUMBER,
  MAX_SEARCH_QUERY_LENGTH,
} from "./constants.js";
import { parseBigcommerceResourceId } from "./resource-id.js";
const pageSchema = z.number().int().min(1).max(MAX_PAGE_NUMBER);
const limitSchema = z.number().int().min(1).max(LIST_MAX_LIMIT);
const productIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((value) => parseBigcommerceResourceId(value, "Product id"));
const treeIdSchema = z
  .union([z.number().int(), z.string().trim().min(1)])
  .transform((value) => parseBigcommerceResourceId(value, "Category tree id"));
export const productListInputSchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
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
export const variantListInputSchema = z
  .object({
    productId: productIdSchema,
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
  })
  .strict();
export const variantListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productId"],
  properties: {
    productId: { type: ["integer", "string"] },
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
  },
};
export const categoryTreeListInputSchema = z.object({}).strict();
export const categoryTreeListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};
export const categoryListInputSchema = z
  .object({
    treeId: treeIdSchema,
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    parentId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseBigcommerceResourceId(value, "Parent id"))
      .optional(),
  })
  .strict();
export const categoryListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["treeId"],
  properties: {
    treeId: { type: ["integer", "string"] },
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    parentId: { type: ["integer", "string"] },
  },
};
export const orderListInputSchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    minDateCreated: z.string().trim().min(1).max(64).optional(),
    maxDateCreated: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export const orderListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, maximum: MAX_PAGE_NUMBER },
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_LIMIT },
    minDateCreated: { type: "string", minLength: 1, maxLength: 64 },
    maxDateCreated: { type: "string", minLength: 1, maxLength: 64 },
  },
};
export const orderGetInputSchema = z
  .object({
    orderId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseBigcommerceResourceId(value, "Order id")),
  })
  .strict();
export const orderGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId"],
  properties: { orderId: { type: ["integer", "string"] } },
};
export const orderProductListInputSchema = z
  .object({
    orderId: z
      .union([z.number().int(), z.string().trim().min(1)])
      .transform((value) => parseBigcommerceResourceId(value, "Order id")),
  })
  .strict();
export const orderProductListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId"],
  properties: { orderId: { type: ["integer", "string"] } },
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
      .transform((value) => parseBigcommerceResourceId(value, "Order id")),
    statusId: z.number().int().min(0).max(99),
  })
  .strict();
export const orderStatusUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId", "statusId"],
  properties: {
    orderId: { type: ["integer", "string"] },
    statusId: { type: "integer", minimum: 0, maximum: 99 },
  },
};
