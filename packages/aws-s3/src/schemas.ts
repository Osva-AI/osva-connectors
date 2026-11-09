import { z } from "zod";

import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";
import type { BucketScopeMap } from "./resource-scope.js";

export const s3ConfigSchema = z
  .object({
    region: z.string().trim().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    allowedBucketsRead: z.custom<BucketScopeMap>().optional(),
    allowedBucketsWrite: z.custom<BucketScopeMap>().optional(),
    accountWideBucketDiscovery: z.boolean().default(false),
    createEnabled: z.boolean().default(false),
    replaceEnabled: z.boolean().default(false),
    hostWritesApproved: z.boolean().default(false),
  })
  .strict();

export type S3Config = z.infer<typeof s3ConfigSchema>;
