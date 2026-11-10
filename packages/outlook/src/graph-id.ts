import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_GRAPH_ID_LENGTH, MAX_SEARCH_QUERY_LENGTH } from "./constants.js";

/** Microsoft Graph resource IDs: base64url-style opaque strings (may include padding). */
const GRAPH_ID_PATTERN = /^[A-Za-z0-9_-]+=*$/;

export function parseGraphResourceId(value: string, label: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_GRAPH_ID_LENGTH ||
    !GRAPH_ID_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  return trimmed;
}

/**
 * Bounded message search string for `$search` (no OData operators beyond quoted search).
 */
export function parseBoundedSearchQuery(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid search query.");
  }
  if (/[\0\r\n]/.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid search query.");
  }
  if (trimmed.includes("$") || trimmed.includes("&")) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid search query.");
  }
  return trimmed;
}
