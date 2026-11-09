import { z } from "zod";

import {
  DEFAULT_LOCATION,
  DEFAULT_MAX_BYTES_BILLED,
  DEFAULT_QUERY_TIMEOUT_MS,
  MAX_MAX_BYTES_BILLED,
  MAX_QUERY_TIMEOUT_MS,
  MIN_MAX_BYTES_BILLED,
  MIN_QUERY_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";
import type { TableColumnAllowlist } from "./resource-scope.js";

export const bigqueryConfigSchema = z
  .object({
    projectId: z.string().trim().min(1),
    location: z.string().trim().min(1).default(DEFAULT_LOCATION),
    queryTimeoutMs: z
      .number()
      .int()
      .min(MIN_QUERY_TIMEOUT_MS)
      .max(MAX_QUERY_TIMEOUT_MS)
      .default(DEFAULT_QUERY_TIMEOUT_MS),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    maxBytesBilled: z
      .number()
      .int()
      .min(MIN_MAX_BYTES_BILLED)
      .max(MAX_MAX_BYTES_BILLED)
      .default(DEFAULT_MAX_BYTES_BILLED),
    allowedDatasets: z.array(z.string().trim().min(1)).optional(),
    allowedTables: z.custom<TableColumnAllowlist>().optional(),
  })
  .strict();

export type BigqueryConfig = z.infer<typeof bigqueryConfigSchema>;
