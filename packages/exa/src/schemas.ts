import { z } from "zod";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const exaConfigSchema = z
  .object({
    apiKey: z.string().trim().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_REQUEST_TIMEOUT_MS),
  })
  .strict();

export type ExaConfig = z.infer<typeof exaConfigSchema>;
