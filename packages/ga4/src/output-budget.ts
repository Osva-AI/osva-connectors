import { ConnectorSdkError } from "@osva-ai/connector-sdk";

/** Maximum UTF-8 byte length of JSON.stringify on structured MCP output. */
export const OUTPUT_MAX_STRUCTURED_JSON_BYTES = 262_144;

export const OUTPUT_MAX_PROVIDER_STRING_LENGTH = 512;
export const OUTPUT_MAX_HEADER_NAME_LENGTH = 128;
export const OUTPUT_MAX_METADATA_NAME_LENGTH = 256;

const OUTPUT_SIZE_LIMIT_MESSAGE =
  "Normalized GA4 response exceeds the connector output size limit.";

const UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE =
  "Google Analytics returned an unexpected payload.";

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

export function normalizeTruncatableProviderString(
  value: unknown,
  maxCodePoints: number,
): { value: string; truncated: boolean } {
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE,
    );
  }
  return truncateUnicodeByCodePoints(value, maxCodePoints);
}

export function normalizeEssentialProviderString(
  value: unknown,
  maxCodePoints: number,
  message = UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE,
): string {
  if (typeof value !== "string") {
    throw new ConnectorSdkError("PROVIDER_ERROR", message);
  }
  if ([...value].length > maxCodePoints) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }
  return value;
}

export function packListWithinOutputBudget<
  TItem,
  TKey extends string,
  TEnvelope extends object,
>(
  envelope: TEnvelope,
  itemsKey: TKey,
  items: readonly TItem[],
): TEnvelope &
  Record<TKey, TItem[]> &
  Partial<Record<`${TKey}Truncated`, true>> {
  const packed: TItem[] = [];
  let itemsTruncated = false;

  for (const item of items) {
    const candidate = {
      ...envelope,
      [itemsKey]: [...packed, item],
    };
    if (
      structuredOutputByteLength(candidate) > OUTPUT_MAX_STRUCTURED_JSON_BYTES
    ) {
      itemsTruncated = true;
      break;
    }
    packed.push(item);
  }

  if (packed.length === 0 && items.length > 0) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }

  return {
    ...envelope,
    [itemsKey]: packed,
    ...(itemsTruncated ? { [`${itemsKey}Truncated`]: true as const } : {}),
  } as TEnvelope &
    Record<TKey, TItem[]> &
    Partial<Record<`${TKey}Truncated`, true>>;
}
