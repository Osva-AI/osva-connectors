import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_CONFLUENCE_ID_LENGTH } from "./constants.js";

const ID_PATTERN = /^[0-9]+$/;

export function parseConfluenceId(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CONFLUENCE_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  if (!ID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  return trimmed;
}

export function validatePaginationCursor(
  cursor: string | undefined,
): string | undefined {
  if (cursor === undefined) {
    return undefined;
  }
  const trimmed = cursor.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > 2048) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination cursor is not valid.",
    );
  }
  return trimmed;
}
