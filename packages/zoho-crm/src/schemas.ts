import { z } from "zod";
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";

export const zohoConfigSchema = z
  .object({
    apiBaseUrl: z.string().url(),
    pinnedOrigin: z.string(),
    accessToken: z.string().min(1),
    allowTestApiHost: z.boolean(),
    allowedDealIds: z.array(z.string().min(1)).optional(),
    allowedTargetStages: z.array(z.string().min(1)).optional(),
    notesEnabled: z.boolean(),
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

export type ZohoConfig = z.infer<typeof zohoConfigSchema>;
