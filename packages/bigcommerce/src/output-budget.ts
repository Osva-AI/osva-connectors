import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export const OUTPUT_MAX_STRUCTURED_JSON_BYTES = 262_144;

const OUTPUT_SIZE_LIMIT_MESSAGE =
  "Normalized BigCommerce response exceeds the connector output size limit.";
const UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE =
  "BigCommerce returned an unexpected payload.";

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
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return truncateUnicodeByCodePoints(value, maxCodePoints).value;
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
  listKey: TKey,
  items: readonly TItem[],
): TEnvelope & Record<TKey, TItem[]> & Partial<Record<"truncated", true>> {
  const packed = { ...envelope, [listKey]: [...items] } as TEnvelope &
    Record<TKey, TItem[]>;
  if (structuredOutputByteLength(packed) <= OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    return packed;
  }
  const trimmed: TItem[] = [];
  for (const item of items) {
    trimmed.push(item);
    const candidate = { ...envelope, [listKey]: trimmed } as TEnvelope &
      Record<TKey, TItem[]>;
    if (
      structuredOutputByteLength(candidate) > OUTPUT_MAX_STRUCTURED_JSON_BYTES
    ) {
      trimmed.pop();
      break;
    }
  }
  return {
    ...envelope,
    [listKey]: trimmed,
    truncated: true as const,
  } as TEnvelope & Record<TKey, TItem[]> & Partial<Record<"truncated", true>>;
}
