import { ConnectorSdkError } from "@osva-ai/connector-sdk";

/** Maximum UTF-8 byte length of JSON.stringify on structured MCP output. */
export const OUTPUT_MAX_STRUCTURED_JSON_BYTES = 262_144;

export const OUTPUT_MAX_IDENTIFIER_LENGTH = 128;
export const OUTPUT_MAX_DATA_TYPE_LENGTH = 256;

const OUTPUT_SIZE_LIMIT_MESSAGE =
  "Normalized PostgreSQL response exceeds the connector output size limit.";

const UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE =
  "PostgreSQL returned an unexpected catalog payload.";

export function structuredOutputByteLength(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function assertStructuredOutputWithinBudget(payload: unknown): void {
  if (structuredOutputByteLength(payload) > OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }
}

export function normalizeProviderIdentifier(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE,
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > OUTPUT_MAX_IDENTIFIER_LENGTH) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `PostgreSQL returned an invalid ${label}.`,
    );
  }
  return trimmed;
}

export function normalizeProviderDataType(value: unknown): string {
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE,
    );
  }
  if (value.length === 0 || value.length > OUTPUT_MAX_DATA_TYPE_LENGTH) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "PostgreSQL returned an invalid column data type.",
    );
  }
  return value;
}
