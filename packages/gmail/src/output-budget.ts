import { ConnectorSdkError } from "@osva-ai/connector-sdk";

/** Maximum UTF-8 byte length of JSON.stringify on structured MCP output. */
export const OUTPUT_MAX_STRUCTURED_JSON_BYTES = 262_144;

export const OUTPUT_MAX_PROVIDER_STRING_LENGTH = 512;

const OUTPUT_SIZE_LIMIT_MESSAGE =
  "Normalized Gmail response exceeds the connector output size limit.";

export function structuredOutputByteLength(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function assertStructuredOutputWithinBudget(payload: unknown): void {
  if (structuredOutputByteLength(payload) > OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }
}

export function truncateUnicodeByCodePoints(
  text: string,
  maxCodePoints: number,
): { value: string; truncated: boolean } {
  if (maxCodePoints <= 0) {
    return { value: "", truncated: text.length > 0 };
  }
  const codePoints = [...text];
  if (codePoints.length <= maxCodePoints) {
    return { value: text, truncated: false };
  }
  return {
    value: codePoints.slice(0, maxCodePoints).join(""),
    truncated: true,
  };
}
