import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface IndexAllowlist {
  readonly allowedIndexes: ReadonlySet<string>;
}

export interface NamespaceAllowlist {
  readonly allowedNamespaces: ReadonlySet<string>;
}

export function createIndexAllowlist(
  indexes: readonly string[] | undefined,
): IndexAllowlist | undefined {
  if (indexes === undefined) {
    return undefined;
  }
  return { allowedIndexes: new Set(indexes) };
}

export function createNamespaceAllowlist(
  namespaces: readonly string[] | undefined,
): NamespaceAllowlist | undefined {
  if (namespaces === undefined) {
    return undefined;
  }
  return { allowedNamespaces: new Set(namespaces) };
}

export function assertIndexAllowed(
  allowlist: IndexAllowlist | undefined,
  indexName: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIndexes.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Index allowlist is explicitly empty; no indexes are permitted.",
    );
  }
  if (!allowlist.allowedIndexes.has(indexName)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "The requested index is not in the configured allowlist.",
    );
  }
}

export function filterIndexesByAllowlist(
  allowlist: IndexAllowlist | undefined,
  names: readonly string[],
): string[] {
  if (allowlist === undefined) {
    return [...names];
  }
  if (allowlist.allowedIndexes.size === 0) {
    return [];
  }
  return names.filter((name) => allowlist.allowedIndexes.has(name));
}

export function assertNamespaceAllowed(
  allowlist: NamespaceAllowlist | undefined,
  namespace: string | undefined,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedNamespaces.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Namespace allowlist is explicitly empty; no namespaces are permitted.",
    );
  }
  const resolved = namespace ?? "";
  if (!allowlist.allowedNamespaces.has(resolved)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "The requested namespace is not in the configured allowlist.",
    );
  }
}
