import { z } from "zod";

import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";

export const googleSheetsConfigSchema = z
  .object({
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    writeEnabled: z.boolean(),
    allowedSpreadsheetIds: z.array(z.string()).optional(),
  })
  .strict();

export type GoogleSheetsConfig = z.infer<typeof googleSheetsConfigSchema>;
