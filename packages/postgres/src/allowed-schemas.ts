import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { postgresIdentifierSchema } from "./identifier.js";

export const MAX_ALLOWED_SCHEMAS = 100;

export function parseAllowedSchemasEnv(
  raw: string | undefined,
): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "PostgreSQL allowed schema list is empty or invalid.",
    );
  }

  if (parts.length > MAX_ALLOWED_SCHEMAS) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "PostgreSQL allowed schema list exceeds the maximum size.",
    );
  }

  const normalized: string[] = [];
  for (const part of parts) {
    const parsed = postgresIdentifierSchema.safeParse(part);
    if (!parsed.success) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "PostgreSQL allowed schema list contains an invalid schema name.",
      );
    }
    if (!normalized.includes(parsed.data)) {
      normalized.push(parsed.data);
    }
  }

  return normalized;
}

export function assertSchemaAllowedByPolicy(
  schema: string,
  allowedSchemas: readonly string[] | undefined,
): void {
  if (allowedSchemas === undefined) {
    return;
  }
  if (!allowedSchemas.includes(schema)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Schema is not permitted by connector configuration.",
    );
  }
}
