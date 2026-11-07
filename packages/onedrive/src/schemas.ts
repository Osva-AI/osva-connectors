import { z } from "zod";

import {
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_MAX_CONTENT_BYTES,
  MAX_MAX_CONTENT_BYTES,
  DEFAULT_SMALL_UPLOAD_MAX_BYTES,
} from "./constants.js";

export const onedriveConfigSchema = z
  .object({
    accessToken: z.string().trim().min(1),
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
    smallUploadMaxBytes: z
      .number()
      .int()
      .min(1)
      .max(DEFAULT_SMALL_UPLOAD_MAX_BYTES),
    writeEnabled: z.boolean().default(false),
    hostWritesApproved: z.boolean().default(false),
    allowedDriveIds: z.array(z.string()).optional(),
    allowedRootItemIds: z.array(z.string()).optional(),
    allowedUploadFolderIds: z.array(z.string()).optional(),
  })
  .strict();

export type OneDriveConfig = z.infer<typeof onedriveConfigSchema>;
