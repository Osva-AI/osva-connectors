import { unexpectedProviderPayloadError } from "./output-budget.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function normalizeIndexListResponse(raw: unknown): {
  indexes: Array<{ name: string }>;
} {
  const root = asRecord(raw);
  const indexesRaw = root?.indexes;
  if (!Array.isArray(indexesRaw)) {
    throw unexpectedProviderPayloadError();
  }
  const indexes: Array<{ name: string }> = [];
  for (const item of indexesRaw) {
    const rec = asRecord(item);
    const name = rec?.name;
    if (typeof name === "string" && name.length > 0) {
      indexes.push({ name });
    }
  }
  return { indexes };
}

export function normalizeDescribeIndexResponse(
  raw: unknown,
): Record<string, unknown> {
  const record = asRecord(raw);
  if (record === undefined) {
    throw unexpectedProviderPayloadError();
  }
  return record;
}

export function normalizeDataPlaneResponse(
  raw: unknown,
): Record<string, unknown> {
  const record = asRecord(raw);
  if (record === undefined) {
    throw unexpectedProviderPayloadError();
  }
  return record;
}

export function normalizeIndexStatsResponse(
  raw: unknown,
  namespace?: string,
): Record<string, unknown> {
  const record = normalizeDataPlaneResponse(raw);
  if (namespace === undefined) {
    return record;
  }
  const namespaces = asRecord(record.namespaces);
  const entry = namespaces?.[namespace];
  if (entry === undefined) {
    return {
      namespace,
      vectorCount: 0,
      namespaces: {},
    };
  }
  const entryRecord = asRecord(entry);
  return {
    namespace,
    ...(entryRecord ?? {}),
    namespaces: { [namespace]: entry },
  };
}
