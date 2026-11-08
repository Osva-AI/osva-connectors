import { z } from "zod";
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";
export const woocommerceConfigSchema = z
  .object({
    apiBaseUrl: z.string().url(),
    pinnedOrigin: z.string(),
    consumerKey: z.string().min(1),
    consumerSecret: z.string().min(1),
    allowLocalHttp: z.boolean(),
    allowedProductIds: z.array(z.number().int().positive()).optional(),
    allowedOrderIds: z.array(z.number().int().positive()).optional(),
    allowedOrderTargetStatuses: z.array(z.string().min(1)).optional(),
    writableProductFields: z.array(z.string().min(1)).min(1),
    writeEnabled: z.boolean(),
    hostWritesApproved: z.boolean(),
    includeOrderPii: z.boolean(),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
  })
  .strict();

export type WoocommerceConfig = z.infer<typeof woocommerceConfigSchema>;
