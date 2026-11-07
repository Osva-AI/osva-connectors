import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface CollectionAllowlist {
  readonly allowedCollections: ReadonlySet<string>;
}

export function createCollectionAllowlist(
  collections: readonly string[] | undefined,
): CollectionAllowlist | undefined {
  if (collections === undefined) {
    return undefined;
  }
  return { allowedCollections: new Set(collections) };
}

export function assertCollectionAllowed(
  allowlist: CollectionAllowlist | undefined,
  collectionName: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedCollections.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Collection allowlist is explicitly empty; no collections are permitted.",
    );
  }
  if (!allowlist.allowedCollections.has(collectionName)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "The requested collection is not in the configured allowlist.",
    );
  }
}

export function filterCollectionsByAllowlist(
  allowlist: CollectionAllowlist | undefined,
  names: readonly string[],
): string[] {
  if (allowlist === undefined) {
    return [...names];
  }
  if (allowlist.allowedCollections.size === 0) {
    return [];
  }
  return names.filter((name) => allowlist.allowedCollections.has(name));
}
