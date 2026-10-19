import { z } from "zod";

import {
  DEFAULT_API_VERSION,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

const API_VERSION_PATTERN = /^\d{4}-\d{2}$/;

export const shopifyConfigSchema = z
  .object({
    myshopifyDomain: z.string().min(1),
    accessToken: z.string().trim().min(1),
    apiVersion: z
      .string()
      .trim()
      .regex(API_VERSION_PATTERN, "API version must match YYYY-MM."),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    graphqlEndpoint: z.string().url(),
  })
  .strict();

export type ShopifyConfig = z.infer<typeof shopifyConfigSchema>;

export const defaultShopifyConfigShape = {
  apiVersion: DEFAULT_API_VERSION,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
} as const;
