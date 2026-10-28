import { z } from "zod";

import {
  MAX_MAX_ROWS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_MAX_ROWS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";
import { crmObjectTypeSchema } from "./property-allowlist.js";

export const hubspotConfigSchema = z
  .object({
    accessToken: z.string().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    maxRows: z.number().int().min(MIN_MAX_ROWS).max(MAX_MAX_ROWS),
    allowedObjectTypes: z.array(crmObjectTypeSchema).min(1),
    includePii: z.boolean(),
  })
  .strict();

export type HubspotConfig = z.infer<typeof hubspotConfigSchema>;
