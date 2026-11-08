import { z } from "zod";

import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";

export const amplitudeConfigSchema = z
  .object({
    apiKey: z.string().min(1),
    secretKey: z.string().min(1),
    region: z.enum(["us", "eu"]),
    apiHost: z.string().url(),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    allowedChartIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type AmplitudeConfig = z.infer<typeof amplitudeConfigSchema>;
