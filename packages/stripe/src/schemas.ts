import { z } from "zod";

import {
  DEFAULT_MAX_ROWS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_MAX_ROWS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_MAX_ROWS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const stripeConfigSchema = z
  .object({
    apiKey: z.string().min(16).max(512),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_REQUEST_TIMEOUT_MS),
    maxRows: z
      .number()
      .int()
      .min(MIN_MAX_ROWS)
      .max(MAX_MAX_ROWS)
      .default(DEFAULT_MAX_ROWS),
    allowedCustomerIds: z.array(z.string()).optional(),
    allowLiveMode: z.boolean().default(false),
  })
  .strict();

export type StripeConfig = z.infer<typeof stripeConfigSchema>;
