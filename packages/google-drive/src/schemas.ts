import { z } from "zod";

import {
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_MAX_CONTENT_BYTES,
  MAX_MAX_CONTENT_BYTES,
} from "./constants.js";

export const googleDriveConfigSchema = z
  .object({
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    maxContentBytes: z
      .number()
      .int()
      .min(MIN_MAX_CONTENT_BYTES)
      .max(MAX_MAX_CONTENT_BYTES),
    allowedDriveIds: z.array(z.string()).optional(),
  })
  .strict();

export type GoogleDriveConfig = z.infer<typeof googleDriveConfigSchema>;
