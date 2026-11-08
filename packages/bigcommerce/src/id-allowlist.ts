import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface NumericIdAllowlist {
  readonly allowedIds: ReadonlySet<number>;
}

export function createNumericIdAllowlist(
  ids: readonly number[] | undefined,
): NumericIdAllowlist | undefined {
  if (ids === undefined) {
    return undefined;
  }
  return { allowedIds: new Set(ids) };
}

export function assertIdAllowed(
  allowlist: NumericIdAllowlist | undefined,
  id: number,
  label: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Resource allowlist is explicitly empty; no resources are permitted.",
    );
  }
  if (!allowlist.allowedIds.has(id)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${label} is not on the host-configured allowlist.`,
    );
  }
}

export function assertMutationAllowlistConfigured(
  allowlist: NumericIdAllowlist | undefined,
  envName: string,
): void {
  if (allowlist === undefined || allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `Mutations require a non-empty ${envName} allowlist.`,
    );
  }
}

export function filterByNumericAllowlist<T>(
  allowlist: NumericIdAllowlist | undefined,
  items: readonly T[],
  idOf: (item: T) => number,
): T[] {
  if (allowlist === undefined) {
    return [...items];
  }
  if (allowlist.allowedIds.size === 0) {
    return [];
  }
  return items.filter((item) => allowlist.allowedIds.has(idOf(item)));
}

export function parseNumericIdList(
  raw: string | undefined,
): number[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [];
  }
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of parts) {
    const value = Number.parseInt(part, 10);
    if (!Number.isInteger(value) || value < 1) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowlist entry must be a positive integer.",
      );
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}
