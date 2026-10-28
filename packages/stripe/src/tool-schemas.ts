import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_CURSOR_LENGTH,
} from "./constants.js";
import {
  parseBalanceTransactionType,
  parseInvoiceStatusFilter,
  parseSubscriptionStatusFilter,
} from "./list-filters.js";
import { parseStripeCustomerId, parseStripeResourceId } from "./resource-id.js";

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

const limitSchema = (defaultLimit: number, maxLimit: number) =>
  z.number().int().min(1).max(maxLimit).optional().default(defaultLimit);

const unixTimestampSchema = z.number().int().min(0).optional();

const stripeIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(255)
    .transform((value, ctx) => {
      try {
        return parseStripeResourceId(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

const customerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .transform((value, ctx) => {
    try {
      return parseStripeCustomerId(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid customer ID." });
      return z.NEVER;
    }
  });

export const accountGetInputSchema = z.object({}).strict();
export const accountGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies DefineToolOptions["inputSchema"];

export const balanceGetInputSchema = z.object({}).strict();
export const balanceGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies DefineToolOptions["inputSchema"];

export const balanceTransactionListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    startingAfter: cursorSchema,
    createdGte: unixTimestampSchema,
    createdLte: unixTimestampSchema,
    type: z
      .string()
      .trim()
      .min(1)
      .optional()
      .transform((value) =>
        value === undefined ? undefined : parseBalanceTransactionType(value),
      ),
  })
  .strict();

export const balanceTransactionListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    startingAfter: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
    },
    createdGte: { type: "integer", minimum: 0 },
    createdLte: { type: "integer", minimum: 0 },
    type: { type: "string", minLength: 1 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const paymentIntentListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    startingAfter: cursorSchema,
    createdGte: unixTimestampSchema,
    createdLte: unixTimestampSchema,
    customerId: customerIdSchema.optional(),
  })
  .strict();

export const paymentIntentListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    startingAfter: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
    },
    createdGte: { type: "integer", minimum: 0 },
    createdLte: { type: "integer", minimum: 0 },
    customerId: { type: "string", minLength: 1, maxLength: 255 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const paymentIntentGetInputSchema = z
  .object({
    paymentIntentId: stripeIdSchema("PaymentIntent ID"),
  })
  .strict();

export const paymentIntentGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["paymentIntentId"],
  properties: {
    paymentIntentId: { type: "string", minLength: 1, maxLength: 255 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const chargeListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    startingAfter: cursorSchema,
    createdGte: unixTimestampSchema,
    createdLte: unixTimestampSchema,
    customerId: customerIdSchema.optional(),
    paymentIntentId: stripeIdSchema("PaymentIntent ID").optional(),
  })
  .strict();

export const chargeListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    startingAfter: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
    },
    createdGte: { type: "integer", minimum: 0 },
    createdLte: { type: "integer", minimum: 0 },
    customerId: { type: "string", minLength: 1, maxLength: 255 },
    paymentIntentId: { type: "string", minLength: 1, maxLength: 255 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const refundListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    startingAfter: cursorSchema,
    createdGte: unixTimestampSchema,
    createdLte: unixTimestampSchema,
    chargeId: stripeIdSchema("Charge ID").optional(),
    paymentIntentId: stripeIdSchema("PaymentIntent ID").optional(),
  })
  .strict();

export const refundListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    startingAfter: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
    },
    createdGte: { type: "integer", minimum: 0 },
    createdLte: { type: "integer", minimum: 0 },
    chargeId: { type: "string", minLength: 1, maxLength: 255 },
    paymentIntentId: { type: "string", minLength: 1, maxLength: 255 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const subscriptionListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    startingAfter: cursorSchema,
    customerId: customerIdSchema.optional(),
    status: z
      .string()
      .trim()
      .min(1)
      .optional()
      .transform((value) =>
        value === undefined ? undefined : parseSubscriptionStatusFilter(value),
      ),
    createdGte: unixTimestampSchema,
    createdLte: unixTimestampSchema,
  })
  .strict();

export const subscriptionListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    startingAfter: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
    },
    customerId: { type: "string", minLength: 1, maxLength: 255 },
    status: { type: "string", minLength: 1 },
    createdGte: { type: "integer", minimum: 0 },
    createdLte: { type: "integer", minimum: 0 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const invoiceListInputSchema = z
  .object({
    limit: limitSchema(LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE),
    startingAfter: cursorSchema,
    customerId: customerIdSchema.optional(),
    subscriptionId: stripeIdSchema("Subscription ID").optional(),
    status: z
      .string()
      .trim()
      .min(1)
      .optional()
      .transform((value) =>
        value === undefined ? undefined : parseInvoiceStatusFilter(value),
      ),
    createdGte: unixTimestampSchema,
    createdLte: unixTimestampSchema,
  })
  .strict();

export const invoiceListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    startingAfter: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CURSOR_LENGTH,
    },
    customerId: { type: "string", minLength: 1, maxLength: 255 },
    subscriptionId: { type: "string", minLength: 1, maxLength: 255 },
    status: { type: "string", minLength: 1 },
    createdGte: { type: "integer", minimum: 0 },
    createdLte: { type: "integer", minimum: 0 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const customerGetInputSchema = z
  .object({
    customerId: customerIdSchema,
  })
  .strict();

export const customerGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["customerId"],
  properties: {
    customerId: { type: "string", minLength: 1, maxLength: 255 },
  },
} as const satisfies DefineToolOptions["inputSchema"];
