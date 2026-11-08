import { z } from "zod";
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";
export const bigcommerceConfigSchema = z
  .object({
    apiHost: z.string().url(),
    storeHash: z.string().min(1),
    accessToken: z.string().min(1),
    allowedProductIds: z.array(z.number().int().positive()).optional(),
    allowedOrderIds: z.array(z.number().int().positive()).optional(),
    allowedCategoryTreeIds: z.array(z.number().int().positive()).optional(),
    allowedOrderTargetStatusIds: z.array(z.number().int().min(0)).optional(),
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

export type BigcommerceConfig = z.infer<typeof bigcommerceConfigSchema>;
