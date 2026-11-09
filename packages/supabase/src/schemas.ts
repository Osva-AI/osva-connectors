import { z } from "zod";

import type { SchemaTableScopeMap } from "./allowed-tables.js";
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "./constants.js";

export const supabaseConfigSchema = z
  .object({
    projectUrl: z.string().url(),
    pinnedOrigin: z.string(),
    restBaseUrl: z.string().url(),
    projectRef: z.string().min(1),
    publishableKey: z.string().min(1),
    userAccessToken: z.string().min(1),
    allowTestApiHost: z.boolean(),
    allowedSchemas: z.array(z.string()).optional(),
    allowedTables: z.custom<SchemaTableScopeMap>().optional(),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    countExactEnabled: z.boolean(),
  })
  .strict();

export type SupabaseConfig = z.infer<typeof supabaseConfigSchema>;
