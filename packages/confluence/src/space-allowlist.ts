import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface SpaceAllowlist {
  readonly allowedIds: ReadonlySet<string>;
}

export function createSpaceAllowlist(
  ids: readonly string[] | undefined,
): SpaceAllowlist | undefined {
  if (ids === undefined) {
    return undefined;
  }
  return { allowedIds: new Set(ids) };
}

export function assertSpaceAllowed(
  allowlist: SpaceAllowlist | undefined,
  spaceId: string,
  label: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Space allowlist is explicitly empty; no Confluence spaces are permitted.",
    );
  }
  if (!allowlist.allowedIds.has(spaceId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} is not on the host-configured space allowlist.`,
    );
  }
}

export function filterBySpaceAllowlist<T extends { spaceId?: string }>(
  allowlist: SpaceAllowlist | undefined,
  items: readonly T[],
): T[] {
  if (allowlist === undefined) {
    return [...items];
  }
  if (allowlist.allowedIds.size === 0) {
    return [];
  }
  return items.filter(
    (item) =>
      item.spaceId !== undefined && allowlist.allowedIds.has(item.spaceId),
  );
}
