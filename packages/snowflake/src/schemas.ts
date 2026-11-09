import { z } from "zod";

import {
  MAX_QUERY_TIMEOUT_SECONDS,
  MIN_QUERY_TIMEOUT_SECONDS,
} from "./constants.js";
import type { AllowedColumnsMap } from "./resource-scope.js";
import type { AllowedTablesMap } from "./resource-scope.js";

export const snowflakeConfigSchema = z
  .object({
    account: z.string().trim().min(1),
    username: z.string().trim().min(1),
    password: z.string().min(1),
    role: z.string().trim().min(1),
    warehouse: z.string().trim().min(1),
    database: z.string().trim().min(1),
    queryTimeoutSeconds: z
      .number()
      .int()
      .min(MIN_QUERY_TIMEOUT_SECONDS)
      .max(MAX_QUERY_TIMEOUT_SECONDS),
    allowedSchemas: z.array(z.string()).optional(),
    allowedTables: z.custom<AllowedTablesMap>().optional(),
    allowedColumns: z.custom<AllowedColumnsMap>().optional(),
  })
  .strict();

export type SnowflakeConfig = z.infer<typeof snowflakeConfigSchema>;
