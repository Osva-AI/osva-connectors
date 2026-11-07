import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface IdAllowlist {
  readonly allowedIds: ReadonlySet<string>;
}

export function createIdAllowlist(
  ids: readonly string[] | undefined,
): IdAllowlist | undefined {
  if (ids === undefined) {
    return undefined;
  }
  return { allowedIds: new Set(ids) };
}

export function assertIdAllowed(
  allowlist: IdAllowlist | undefined,
  id: string,
  label: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} allowlist is explicitly empty; no resources are permitted.`,
    );
  }
  if (!allowlist.allowedIds.has(id)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} is not on the host-configured allowlist.`,
    );
  }
}

export function filterByIdAllowlist<T>(
  allowlist: IdAllowlist | undefined,
  items: readonly T[],
  idOf: (item: T) => string | undefined,
): T[] {
  if (allowlist === undefined) {
    return [...items];
  }
  if (allowlist.allowedIds.size === 0) {
    return [];
  }
  return items.filter((item) => {
    const id = idOf(item);
    return id !== undefined && allowlist.allowedIds.has(id);
  });
}
