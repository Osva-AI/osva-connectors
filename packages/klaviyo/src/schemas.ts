import { z } from "zod";

import {
  MAX_MAX_ROWS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_MAX_ROWS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const klaviyoConfigSchema = z
  .object({
    privateApiKey: z.string().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    maxRows: z.number().int().min(MIN_MAX_ROWS).max(MAX_MAX_ROWS),
  })
  .strict();

export type KlaviyoConfig = z.infer<typeof klaviyoConfigSchema>;
