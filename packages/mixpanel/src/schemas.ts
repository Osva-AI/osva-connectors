import { z } from "zod";

import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";
import { mixpanelRegionSchema } from "./mixpanel-region.js";

export const mixpanelConfigSchema = z
  .object({
    serviceAccountUsername: z.string().trim().min(1),
    serviceAccountSecret: z.string().trim().min(1),
    projectId: z.number().int().positive(),
    region: mixpanelRegionSchema,
    workspaceId: z.number().int().positive().optional(),
    allowedBookmarkIds: z.array(z.string().trim().min(1)).optional(),
    allowedFunnelIds: z.array(z.string().trim().min(1)).optional(),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
  })
  .strict();

export type MixpanelConfig = z.infer<typeof mixpanelConfigSchema>;
