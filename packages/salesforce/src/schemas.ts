import { z } from "zod";
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";

const apiVersionPattern = /^v\d{1,3}\.\d+$/;

export const salesforceConfigSchema = z
  .object({
    instanceUrl: z.string().url(),
    pinnedOrigin: z.string(),
    apiDataBaseUrl: z.string().url(),
    apiVersion: z.string().regex(apiVersionPattern),
    accessToken: z.string().min(1),
    allowTestApiHost: z.boolean(),
    allowedOpportunityIds: z.array(z.string().min(1)).optional(),
    allowedTaskParentIds: z.array(z.string().min(1)).optional(),
    allowedTargetStages: z.array(z.string().min(1)).optional(),
    stageUpdatesEnabled: z.boolean(),
    tasksEnabled: z.boolean(),
    hostWritesApproved: z.boolean(),
    includePii: z.boolean(),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
  })
  .strict();

export type SalesforceConfig = z.infer<typeof salesforceConfigSchema>;
