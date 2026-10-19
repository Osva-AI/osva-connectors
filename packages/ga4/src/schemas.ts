import { z } from "zod";

import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";
import { normalizePropertyIdInput } from "./property-id.js";

export const ga4ConfigSchema = z
  .object({
    defaultPropertyId: z
      .union([z.string(), z.number()])
      .optional()
      .transform((value) => normalizePropertyIdInput(value)),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
  })
  .strict();

export type Ga4Config = z.infer<typeof ga4ConfigSchema>;
