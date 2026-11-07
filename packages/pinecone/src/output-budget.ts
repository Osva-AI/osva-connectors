import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export const OUTPUT_MAX_STRUCTURED_JSON_BYTES = 262_144;
export const OUTPUT_MAX_PROVIDER_STRING_LENGTH = 8_192;

const OUTPUT_SIZE_LIMIT_MESSAGE =
  "Normalized Pinecone response exceeds the connector output size limit.";

const UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE =
  "Pinecone returned an unexpected payload.";

export function structuredOutputByteLength(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function assertStructuredOutputWithinBudget(payload: unknown): void {
  if (structuredOutputByteLength(payload) > OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }
}

export function packListWithinOutputBudget<T extends Record<string, unknown>>(
  envelope: T,
  listKey: keyof T & string,
  items: readonly unknown[],
): T & Record<string, unknown> {
  const packed = { ...envelope, [listKey]: items } as T &
    Record<string, unknown>;
  if (structuredOutputByteLength(packed) <= OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    return packed;
  }
  const trimmed: unknown[] = [];
  for (const item of items) {
    trimmed.push(item);
    const candidate = { ...envelope, [listKey]: trimmed };
    if (
      structuredOutputByteLength(candidate) > OUTPUT_MAX_STRUCTURED_JSON_BYTES
    ) {
      trimmed.pop();
      break;
    }
  }
  return { ...envelope, [listKey]: trimmed, truncated: true } as T &
    Record<string, unknown>;
}

export function unexpectedProviderPayloadError(): ConnectorSdkError {
  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE,
  );
}
