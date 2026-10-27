import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { META_GRAPH_API_VERSION, MAX_CURSOR_LENGTH } from "./constants.js";

const CURSOR_PATTERN = /^[A-Za-z0-9+/=_-]{1,512}$/;

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
  if (trimmed.length > MAX_CURSOR_LENGTH || !CURSOR_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination cursor is not valid.",
    );
  }
  return trimmed;
}

export interface GraphPagingCursors {
  readonly before?: string;
  readonly after?: string;
}

export interface GraphPaging {
  readonly cursors?: GraphPagingCursors;
  readonly next?: string;
  readonly previous?: string;
}

export function extractAfterCursor(paging: unknown): string | undefined {
  if (paging === null || typeof paging !== "object") {
    return undefined;
  }
  const cursors = (paging as GraphPaging).cursors;
  if (cursors === undefined || typeof cursors !== "object") {
    return undefined;
  }
  const after = cursors.after;
  if (typeof after !== "string" || after.length === 0) {
    return undefined;
  }
  return validatePaginationCursor(after);
}

/**
 * Rejects provider-supplied next/previous URLs (never followed).
 * Validates that any embedded cursor host matches the fixed Graph API host.
 */
export function assertPagingLinksSafe(paging: unknown, apiHost: string): void {
  if (paging === null || typeof paging !== "object") {
    return;
  }
  const record = paging as GraphPaging;
  for (const link of [record.next, record.previous]) {
    if (typeof link !== "string" || link.length === 0) {
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Meta Ads returned an invalid pagination link.",
      );
    }
    const allowedHost = new URL(apiHost).host;
    const isLocalTest =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (isLocalTest && apiHost.startsWith("http://")) {
      continue;
    }
    if (parsed.protocol !== "https:" || parsed.host !== allowedHost) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Meta Ads pagination link host is not allowlisted.",
      );
    }
    if (!parsed.pathname.includes(`/${META_GRAPH_API_VERSION}/`)) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Meta Ads pagination link version is not supported.",
      );
    }
  }
}
