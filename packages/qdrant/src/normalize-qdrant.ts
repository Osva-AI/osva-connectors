import { unexpectedProviderPayloadError } from "./output-budget.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function normalizeCollectionListResponse(raw: unknown): {
  collections: Array<{ name: string }>;
} {
  const root = asRecord(raw);
  const result = root ? asRecord(root.result) : undefined;
  const collectionsRaw = result?.collections;
  if (!Array.isArray(collectionsRaw)) {
    throw unexpectedProviderPayloadError();
  }
  const collections: Array<{ name: string }> = [];
  for (const item of collectionsRaw) {
    const rec = asRecord(item);
    const name = rec?.name;
    if (typeof name === "string" && name.length > 0) {
      collections.push({ name });
    }
  }
  return { collections };
}

export function normalizeCollectionGetResponse(
  raw: unknown,
): Record<string, unknown> {
  const root = asRecord(raw);
  const result = root?.result;
  const record = asRecord(result);
  if (record === undefined) {
    throw unexpectedProviderPayloadError();
  }
  return record;
}

export function normalizePointsResult(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw);
  const result = root?.result;
  const record = asRecord(result);
  if (record === undefined) {
    throw unexpectedProviderPayloadError();
  }
  return record;
}
