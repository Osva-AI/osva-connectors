import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { HUBSPOT_API_HOST, MAX_CURSOR_LENGTH } from "./constants.js";

const CURSOR_PATTERN = /^[A-Za-z0-9+/=_%-]{1,512}$/;

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

interface HubspotPagingNext {
  readonly after?: string;
  readonly link?: string;
}

interface HubspotPaging {
  readonly next?: HubspotPagingNext;
}

/**
 * Rejects provider-supplied pagination links (never followed directly).
 */
export function assertPagingLinksSafe(paging: unknown, apiHost: string): void {
  if (paging === null || typeof paging !== "object") {
    return;
  }
  const next = (paging as HubspotPaging).next;
  if (next === null || typeof next !== "object") {
    return;
  }
  const link = next.link;
  if (typeof link !== "string" || link.length === 0) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot returned an invalid pagination link.",
    );
  }
  const allowedHost = new URL(apiHost).host;
  const isLocalTest =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (isLocalTest && apiHost.startsWith("http://")) {
    return;
  }
  if (parsed.protocol !== "https:" || parsed.host !== allowedHost) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot pagination link host is not allowlisted.",
    );
  }
  if (!parsed.pathname.includes("/crm/")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot pagination link path is not supported.",
    );
  }
}

export function extractAfterCursor(
  paging: unknown,
  apiHost: string = HUBSPOT_API_HOST,
): string | undefined {
  assertPagingLinksSafe(paging, apiHost);
  if (paging === null || typeof paging !== "object") {
    return undefined;
  }
  const next = (paging as HubspotPaging).next;
  if (next === null || typeof next !== "object") {
    return undefined;
  }
  const after = next.after;
  if (typeof after !== "string" || after.length === 0) {
    return undefined;
  }
  return validatePaginationCursor(after);
}

export function parseHubspotListResponse(
  raw: unknown,
  apiHost: string = HUBSPOT_API_HOST,
): {
  results: unknown[];
  nextCursor: string | undefined;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot returned an unexpected list payload.",
    );
  }
  const record = raw as { results?: unknown; paging?: unknown };
  const results = Array.isArray(record.results) ? record.results : [];
  const nextCursor = extractAfterCursor(record.paging, apiHost);
  return { results, nextCursor };
}
