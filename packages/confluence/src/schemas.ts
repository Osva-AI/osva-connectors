import { z } from "zod";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const confluenceConfigSchema = z
  .object({
    apiBaseV2: z.string().trim().url(),
    apiBaseRest: z.string().trim().url(),
    authorizationHeader: z.string().trim().min(1),
    credentialForRedaction: z.string().trim().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_REQUEST_TIMEOUT_MS),
    writeEnabled: z.boolean().default(false),
    hostWritesApproved: z.boolean().default(false),
    allowedSpaceIds: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export type ConfluenceConfig = z.infer<typeof confluenceConfigSchema>;
