import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_LINEAR_ID_LENGTH } from "./constants.js";

const UUID_HYPHENATED =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_COMPACT = /^[0-9a-f]{32}$/i;

export function parseLinearId(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LINEAR_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  if (!UUID_HYPHENATED.test(trimmed) && !UUID_COMPACT.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  return trimmed.toLowerCase();
}

export function formatLinearIdForApi(canonical: string): string {
  const compact = canonical.replace(/-/g, "").toLowerCase();
  if (compact.length !== 32) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid Linear ID.");
  }
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function validatePaginationCursor(
  cursor: string | undefined,
): string | undefined {
  if (cursor === undefined) {
    return undefined;
  }
  const trimmed = cursor.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid pagination cursor.");
  }
  if (trimmed.length > 512) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid pagination cursor.");
  }
  return trimmed;
}
