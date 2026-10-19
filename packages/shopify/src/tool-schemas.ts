import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  MAX_CURSOR_LENGTH,
  MAX_SHOPIFY_SEARCH_QUERY_LENGTH,
} from "./constants.js";
import { GID_INPUT_PATTERN } from "./gid.js";

const paginationFields = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_MAX_LIMIT)
    .optional()
    .default(LIST_DEFAULT_LIMIT),
  cursor: z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional(),
};

const shopifySearchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SHOPIFY_SEARCH_QUERY_LENGTH)
  .optional();

export const shopGetInputSchema = z.object({}).strict();

export const shopGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const productListInputSchema = z
  .object({
    ...paginationFields,
    query: shopifySearchQuerySchema,
  })
  .strict();

export type ProductListInput = z.infer<typeof productListInputSchema>;

export const productListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: LIST_MAX_LIMIT,
      description: "Maximum products to return (default 25, max 100).",
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
      description:
        "Opaque pagination cursor from a previous response pageInfo.endCursor.",
    },
    query: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SHOPIFY_SEARCH_QUERY_LENGTH,
      description: "Optional Shopify products search query (bounded).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

const productGidSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(GID_INPUT_PATTERN.product, "Invalid Shopify product ID.");

export const productGetInputSchema = z
  .object({
    id: productGidSchema,
  })
  .strict();

export type ProductGetInput = z.infer<typeof productGetInputSchema>;

export const productGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      description: "Shopify product GID (gid://shopify/Product/...).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const orderListInputSchema = z
  .object({
    ...paginationFields,
    query: shopifySearchQuerySchema,
  })
  .strict();

export type OrderListInput = z.infer<typeof orderListInputSchema>;

export const orderListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: LIST_MAX_LIMIT,
      description: "Maximum orders to return (default 25, max 100).",
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
      description:
        "Opaque pagination cursor from a previous response pageInfo.endCursor.",
    },
    query: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SHOPIFY_SEARCH_QUERY_LENGTH,
      description: "Optional Shopify orders search query (bounded).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const orderGetInputSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(GID_INPUT_PATTERN.order, "Invalid Shopify order ID."),
  })
  .strict();

export type OrderGetInput = z.infer<typeof orderGetInputSchema>;

export const orderGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      description: "Shopify order GID (gid://shopify/Order/...).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const inventoryLevelsListInputSchema = z
  .object({
    locationId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(GID_INPUT_PATTERN.location, "Invalid Shopify location ID.")
      .optional(),
    inventoryItemId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(
        GID_INPUT_PATTERN.inventoryItem,
        "Invalid Shopify inventory item ID.",
      )
      .optional(),
    ...paginationFields,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.locationId === undefined && value.inventoryItemId === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Provide locationId or inventoryItemId.",
      });
    }
  });

export type InventoryLevelsListInput = z.infer<
  typeof inventoryLevelsListInputSchema
>;

export const inventoryLevelsListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    locationId: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      description: "Optional location GID to scope inventory levels.",
    },
    inventoryItemId: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      description: "Optional inventory item GID to scope inventory levels.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: LIST_MAX_LIMIT,
      description: "Maximum inventory levels to return (default 25, max 100).",
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
      description:
        "Opaque pagination cursor from a previous response pageInfo.endCursor.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const locationListInputSchema = z.object(paginationFields).strict();

export type LocationListInput = z.infer<typeof locationListInputSchema>;

export const locationListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: LIST_MAX_LIMIT,
      description: "Maximum locations to return (default 25, max 100).",
    },
    cursor: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
      description:
        "Opaque pagination cursor from a previous response pageInfo.endCursor.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];
