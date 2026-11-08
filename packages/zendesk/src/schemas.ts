import { z } from "zod";
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";

export const zendeskConfigSchema = z
  .object({
    apiBaseUrl: z.string().url(),
    pinnedOrigin: z.string(),
    email: z.string().min(1),
    apiToken: z.string().min(1),
    allowTestApiHost: z.boolean(),
    allowedResourceIds: z.array(z.number().int().positive()).optional(),
    allowedTargetStatuses: z.array(z.string().min(1)).optional(),
    notesEnabled: z.boolean(),
    statusEnabled: z.boolean(),
    hostWritesApproved: z.boolean(),
    includePii: z.boolean(),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
  })
  .strict();

export type ZendeskConfig = z.infer<typeof zendeskConfigSchema>;
