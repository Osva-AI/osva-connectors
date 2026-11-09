import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export type ContainerScopeMap = Readonly<Record<string, readonly string[]>>;

export function parseContainerScopeMap(
  raw: string | undefined,
  label: string,
): ContainerScopeMap | undefined {
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
      `${label} must be valid JSON object mapping container names to prefix arrays.`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be a JSON object.`,
    );
  }
  const out: Record<string, string[]> = {};
  for (const [container, prefixes] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (container.trim().length === 0) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `${label} contains an empty container name.`,
      );
    }
    if (!Array.isArray(prefixes)) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        `${label} container "${container}" must map to a prefix array.`,
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
    out[container] = normalized;
  }
  return out;
}

/**
 * Prefix matching follows Azure Blob listBlobsFlat string-prefix semantics.
 * An empty authorized prefix (`""`) means the entire container is in scope.
 * An empty prefix array is deny-all, not unrestricted.
 */
function keyMatchesPrefix(key: string, prefix: string): boolean {
  if (prefix.length === 0) {
    return true;
  }
  return key === prefix || key.startsWith(prefix);
}

function listPrefixIsAuthorized(
  requestedPrefix: string,
  allowedPrefix: string,
): boolean {
  if (allowedPrefix.length === 0) {
    return true;
  }
  return (
    requestedPrefix === allowedPrefix ||
    requestedPrefix.startsWith(allowedPrefix)
  );
}

export function assertContainerAllowed(
  map: ContainerScopeMap | undefined,
  container: string,
): void {
  if (map === undefined) {
    return;
  }
  if (Object.keys(map).length === 0) {
    throw new ConnectorSdkError("FORBIDDEN", "No containers are allowed.");
  }
  if (!(container in map)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Container is not in the allowed set.",
    );
  }
}

export function assertBlobKeyAllowed(
  map: ContainerScopeMap | undefined,
  container: string,
  key: string,
): void {
  assertContainerAllowed(map, container);
  if (map === undefined) {
    return;
  }
  const prefixes = map[container] ?? [];
  if (prefixes.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "No object prefixes are allowed for this container.",
    );
  }
  if (!prefixes.some((prefix) => keyMatchesPrefix(key, prefix))) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Object key is outside allowed prefixes for this container.",
    );
  }
}

export function assertListPrefixAllowed(
  map: ContainerScopeMap | undefined,
  container: string,
  prefix: string,
): void {
  assertContainerAllowed(map, container);
  if (map === undefined) {
    return;
  }
  const prefixes = map[container] ?? [];
  if (prefixes.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "No object prefixes are allowed for this container.",
    );
  }
  if (!prefixes.some((allowed) => listPrefixIsAuthorized(prefix, allowed))) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "List prefix is outside allowed prefixes for this container.",
    );
  }
}

export function filterKeysByAuthorizedPrefixes<
  T extends { readonly key: string },
>(
  map: ContainerScopeMap | undefined,
  container: string,
  items: readonly T[],
): T[] {
  if (map === undefined) {
    return [...items];
  }
  const prefixes = map[container] ?? [];
  if (prefixes.length === 0) {
    return [];
  }
  return items.filter((item) =>
    prefixes.some((prefix) => keyMatchesPrefix(item.key, prefix)),
  );
}
