import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { MAX_RECORD_ID_LENGTH } from "./constants.js";

export interface StringIdAllowlist {
  readonly allowedIds: ReadonlySet<string>;
}

export function createStringIdAllowlist(
  ids: readonly string[] | undefined,
): StringIdAllowlist | undefined {
  if (ids === undefined) return undefined;
  return { allowedIds: new Set(ids) };
}

export function assertIdAllowed(
  allowlist: StringIdAllowlist | undefined,
  id: string,
  label: string,
): void {
  if (allowlist === undefined) return;
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
  allowlist: StringIdAllowlist | undefined,
  envName: string,
): void {
  if (allowlist === undefined || allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `Mutations require a non-empty ${envName} allowlist.`,
    );
  }
}

export function filterByStringAllowlist<T>(
  allowlist: StringIdAllowlist | undefined,
  items: readonly T[],
  idOf: (item: T) => string,
): T[] {
  if (allowlist === undefined) return [...items];
  if (allowlist.allowedIds.size === 0) return [];
  return items.filter((item) => allowlist.allowedIds.has(idOf(item)));
}

export function parseStringIdList(
  raw: string | undefined,
): string[] | undefined {
  if (raw === undefined) return undefined;
  if (raw.trim().length === 0) return [];
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (part.length > MAX_RECORD_ID_LENGTH) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowlist record id is too long.",
      );
    }
    if (seen.has(part)) continue;
    seen.add(part);
    out.push(part);
  }
  return out;
}
