import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  MAX_CONNECT_TIMEOUT_MS,
  MAX_POOL_MAX,
  MAX_QUERY_TIMEOUT_MS,
  MAX_TOTAL_TIMEOUT_MS,
  MIN_CONNECT_TIMEOUT_MS,
  MIN_POOL_MAX,
  MIN_QUERY_TIMEOUT_MS,
  MIN_TOTAL_TIMEOUT_MS,
  OUTPUT_MAX_SERVER_VERSION_LENGTH,
} from "./constants.js";
import { postgresSslModeSchema } from "./ssl.js";

const POSTGRES_URL_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export function isPostgresConnectionUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return POSTGRES_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export const postgresConfigSchema = z.object({
  connectionUrl: z
    .string()
    .trim()
    .min(1, "Connection URL must not be empty.")
    .refine(
      isPostgresConnectionUrl,
      "Connection URL is not a valid PostgreSQL URL.",
    ),
  sslMode: postgresSslModeSchema,
  connectTimeoutMs: z
    .number()
    .int()
    .min(MIN_CONNECT_TIMEOUT_MS)
    .max(MAX_CONNECT_TIMEOUT_MS),
  queryTimeoutMs: z
    .number()
    .int()
    .min(MIN_QUERY_TIMEOUT_MS)
    .max(MAX_QUERY_TIMEOUT_MS),
  poolMax: z.number().int().min(MIN_POOL_MAX).max(MAX_POOL_MAX),
  totalTimeoutMs: z
    .number()
    .int()
    .min(MIN_TOTAL_TIMEOUT_MS)
    .max(MAX_TOTAL_TIMEOUT_MS),
  allowedSchemas: z.array(z.string()).optional(),
});

export type PostgresConfig = z.infer<typeof postgresConfigSchema>;

export const connectionTestInputSchema = z.object({}).strict();

export type ConnectionTestInput = z.infer<typeof connectionTestInputSchema>;

export const connectionTestInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies DefineToolOptions["inputSchema"];

export const connectionTestOutputSchema = z.object({
  ok: z.literal(true),
  serverVersion: z.string().max(OUTPUT_MAX_SERVER_VERSION_LENGTH),
});

export type ConnectionTestOutput = z.infer<typeof connectionTestOutputSchema>;
