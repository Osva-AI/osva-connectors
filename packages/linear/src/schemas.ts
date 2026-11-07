import { z } from "zod";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const linearConfigSchema = z
  .object({
    authorizationHeader: z.string().trim().min(1),
    credentialForRedaction: z.string().trim().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_REQUEST_TIMEOUT_MS),
    writeEnabled: z.boolean().default(false),
    hostMutationsApproved: z.boolean().default(false),
    allowedTeamIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type LinearConfig = z.infer<typeof linearConfigSchema>;
