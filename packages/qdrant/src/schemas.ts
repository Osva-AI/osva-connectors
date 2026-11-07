import { z } from "zod";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const qdrantConfigSchema = z
  .object({
    baseUrl: z.string().trim().min(1),
    apiKey: z.string().trim().optional(),
    allowLocalHttp: z.boolean().default(false),
    allowedCollections: z.array(z.string().trim().min(1)).optional(),
    writeEnabled: z.boolean().default(false),
    hostWritesApproved: z.boolean().default(false),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_REQUEST_TIMEOUT_MS),
  })
  .strict();

export type QdrantConfig = z.infer<typeof qdrantConfigSchema>;
