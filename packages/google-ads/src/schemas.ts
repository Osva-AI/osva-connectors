import { z } from "zod";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_MAX_ROWS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_MAX_ROWS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const googleAdsConfigSchema = z
  .object({
    loginCustomerId: z.string().optional(),
    allowedCustomerIds: z.array(z.string()).optional(),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_REQUEST_TIMEOUT_MS),
    maxRows: z.number().int().min(MIN_MAX_ROWS).max(MAX_MAX_ROWS).default(100),
    developerToken: z.string().optional(),
  })
  .strict();

export type GoogleAdsConfig = z.infer<typeof googleAdsConfigSchema>;
