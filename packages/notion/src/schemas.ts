import { z } from "zod";

import {
  DEFAULT_MAX_BLOCK_DEPTH,
  DEFAULT_NOTION_API_VERSION,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_MAX_BLOCK_DEPTH,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_MAX_BLOCK_DEPTH,
  MIN_REQUEST_TIMEOUT_MS,
  SUPPORTED_NOTION_API_VERSIONS,
} from "./constants.js";

const supportedApiVersionSchema = z.enum(SUPPORTED_NOTION_API_VERSIONS);

export const notionConfigSchema = z
  .object({
    accessToken: z.string().trim().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS)
      .default(DEFAULT_REQUEST_TIMEOUT_MS),
    apiVersion: supportedApiVersionSchema.default(DEFAULT_NOTION_API_VERSION),
    writeEnabled: z.boolean().default(false),
    hostWritesApproved: z.boolean().default(false),
    maxBlockDepth: z
      .number()
      .int()
      .min(MIN_MAX_BLOCK_DEPTH)
      .max(MAX_MAX_BLOCK_DEPTH)
      .default(DEFAULT_MAX_BLOCK_DEPTH),
  })
  .strict();

export type NotionConfig = z.infer<typeof notionConfigSchema>;
