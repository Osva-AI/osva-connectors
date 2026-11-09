import { z } from "zod";

import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";
import type { ContainerScopeMap } from "./resource-scope.js";

export const azureBlobConfigSchema = z
  .object({
    accountName: z.string().trim().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    allowedContainersRead: z.custom<ContainerScopeMap>().optional(),
    allowedContainersWrite: z.custom<ContainerScopeMap>().optional(),
    accountWideContainerDiscovery: z.boolean().default(false),
    createEnabled: z.boolean().default(false),
    replaceEnabled: z.boolean().default(false),
    hostWritesApproved: z.boolean().default(false),
  })
  .strict();

export type AzureBlobConfig = z.infer<typeof azureBlobConfigSchema>;
