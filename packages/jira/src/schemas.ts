import { z } from "zod";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const jiraConfigSchema = z
  .object({
    apiBasePath: z.string().trim().min(1),
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
    allowedProjectKeys: z.array(z.string().trim().min(1).max(64)).optional(),
  })
  .strict();

export type JiraConfig = z.infer<typeof jiraConfigSchema>;
