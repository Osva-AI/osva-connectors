import { z } from "zod";

/** Unquoted PostgreSQL identifiers (defense in depth; queries use parameters). */
export const postgresIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(63, "Identifier must be at most 63 characters.")
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Identifier contains invalid characters.");

export type PostgresIdentifier = z.infer<typeof postgresIdentifierSchema>;

export function parsePostgresIdentifier(
  value: unknown,
): PostgresIdentifier | undefined {
  const parsed = postgresIdentifierSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
