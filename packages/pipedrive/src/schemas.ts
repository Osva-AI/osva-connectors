import { z } from "zod";
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";

export const pipedriveConfigSchema = z
  .object({
    apiBaseUrl: z.string().url(),
    pinnedOrigin: z.string(),
    apiToken: z.string().min(1),
    allowTestApiHost: z.boolean(),
    allowedDealIds: z.array(z.number().int().positive()).optional(),
    allowedStageIds: z.array(z.number().int().positive()).optional(),
    stageUpdatesEnabled: z.boolean(),
    hostWritesApproved: z.boolean(),
    includePii: z.boolean(),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
  })
  .strict();

export type PipedriveConfig = z.infer<typeof pipedriveConfigSchema>;
