import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export type BucketScopeMap = Readonly<Record<string, readonly string[]>>;

export function parseBucketScopeMap(
  raw: string | undefined,
  label: string,
): BucketScopeMap | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be valid JSON object mapping bucket names to prefix arrays.`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be a JSON object.`,
    );
  }
  const out: Record<string, string[]> = {};
  for (const [bucket, prefixes] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (bucket.trim().length === 0) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `${label} contains an empty bucket name.`,
      );
    }
    if (!Array.isArray(prefixes)) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `${label} bucket "${bucket}" must map to a prefix array.`,
      );
    }
    const normalized: string[] = [];
    for (const entry of prefixes) {
      if (typeof entry !== "string") {
        throw new ConnectorSdkError(
          "CONFIGURATION_ERROR",
          `${label} prefixes must be strings.`,
        );
      }
      normalized.push(entry);
    }
    out[bucket] = normalized;
  }
  return out;
}

function keyMatchesPrefix(key: string, prefix: string): boolean {
  if (prefix.length === 0) {
    return true;
  }
  return key === prefix || key.startsWith(prefix);
}

export function assertBucketAllowed(
  map: BucketScopeMap | undefined,
  bucket: string,
): void {
  if (map === undefined) {
    return;
  }
  if (Object.keys(map).length === 0) {
    throw new ConnectorSdkError("FORBIDDEN", "No buckets are allowed.");
  }
  if (!(bucket in map)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Bucket is not in the allowed set.",
    );
  }
}

export function assertObjectKeyAllowed(
  map: BucketScopeMap | undefined,
  bucket: string,
  key: string,
): void {
  assertBucketAllowed(map, bucket);
  if (map === undefined) {
    return;
  }
  const prefixes = map[bucket] ?? [];
  if (prefixes.length === 0) {
    return;
  }
  if (!prefixes.some((prefix) => keyMatchesPrefix(key, prefix))) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Object key is outside allowed prefixes for this bucket.",
    );
  }
}

export function assertListPrefixAllowed(
  map: BucketScopeMap | undefined,
  bucket: string,
  prefix: string,
): void {
  assertBucketAllowed(map, bucket);
  if (map === undefined || prefix.length === 0) {
    return;
  }
  const prefixes = map[bucket] ?? [];
  if (prefixes.length === 0) {
    return;
  }
  if (
    !prefixes.some(
      (allowed) =>
        prefix === allowed ||
        prefix.startsWith(allowed) ||
        allowed.startsWith(prefix),
    )
  ) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "List prefix is outside allowed prefixes for this bucket.",
    );
  }
}
