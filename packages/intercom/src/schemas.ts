import { z } from "zod";
import {
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  MAX_ADMIN_ID_LENGTH,
} from "./constants.js";

export const intercomConfigSchema = z
  .object({
    apiBaseUrl: z.string().url(),
    pinnedOrigin: z.string(),
    accessToken: z.string().min(1),
    adminId: z.string().min(1).max(MAX_ADMIN_ID_LENGTH),
    allowTestApiHost: z.boolean(),
    allowedResourceIds: z.array(z.string().min(1)).optional(),
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

export type IntercomConfig = z.infer<typeof intercomConfigSchema>;
