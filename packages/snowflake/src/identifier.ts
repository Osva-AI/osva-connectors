import { z } from "zod";

import { MAX_IDENTIFIER_LENGTH } from "./constants.js";

/** Snowflake unquoted identifier subset (defense in depth). */
export const snowflakeIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(MAX_IDENTIFIER_LENGTH, "Identifier exceeds maximum length.")
  .regex(
    /^[A-Za-z_][A-Za-z0-9_$]*$/,
    "Identifier contains invalid characters.",
  );

export type SnowflakeIdentifier = z.infer<typeof snowflakeIdentifierSchema>;

export function quoteSnowflakeIdentifier(name: SnowflakeIdentifier): string {
  return `"${name.replaceAll('"', '""')}"`;
}
