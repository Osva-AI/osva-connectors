import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { SpaceAllowlist } from "./space-allowlist.js";

function escapeCqlStringLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildScopedCql(
  userCql: string | undefined,
  allowlist: SpaceAllowlist | undefined,
): string {
  if (allowlist === undefined) {
    const trimmed = userCql?.trim() ?? "";
    if (trimmed.length === 0) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "CQL query is required when no space allowlist is configured.",
      );
    }
    return trimmed;
  }

  if (allowlist.allowedIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Space allowlist is explicitly empty; CQL search is not permitted.",
    );
  }

  const spaceClause = `space in (${[...allowlist.allowedIds]
    .map((id) => `"${escapeCqlStringLiteral(id)}"`)
    .join(", ")})`;

  const trimmed = userCql?.trim() ?? "";
  if (trimmed.length === 0) {
    return spaceClause;
  }

  const lower = trimmed.toLowerCase();
  if (/\bspace\s*(!=|not in|in)\b/.test(lower)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "CQL must not include space predicates when a space allowlist is configured.",
    );
  }

  return `(${trimmed}) AND ${spaceClause}`;
}

export function filterSearchResultsByAllowlist<T extends { spaceId?: string }>(
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
      item.spaceId === undefined || allowlist.allowedIds.has(item.spaceId),
  );
}
