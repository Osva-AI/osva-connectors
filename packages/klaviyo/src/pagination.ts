import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { KLAVIYO_API_HOST, MAX_CURSOR_LENGTH } from "./constants.js";

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

export interface KlaviyoListLinks {
  readonly self?: string;
  readonly next?: string;
  readonly prev?: string;
}

/**
 * Rejects provider-supplied next/prev URLs (never followed directly).
 * Validates that pagination link hosts match the fixed Klaviyo API host.
 */
export function assertListLinksSafe(links: unknown, apiHost: string): void {
  if (links === null || typeof links !== "object") {
    return;
  }
  const record = links as KlaviyoListLinks;
  for (const link of [record.next, record.prev]) {
    if (typeof link !== "string" || link.length === 0) {
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Klaviyo returned an invalid pagination link.",
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
        "Klaviyo pagination link host is not allowlisted.",
      );
    }
    if (!parsed.pathname.startsWith("/api/")) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Klaviyo pagination link path is not supported.",
      );
    }
  }
}

export function extractCursorFromNextLink(
  links: unknown,
  apiHost: string,
): string | undefined {
  assertListLinksSafe(links, apiHost);
  if (links === null || typeof links !== "object") {
    return undefined;
  }
  const next = (links as KlaviyoListLinks).next;
  if (typeof next !== "string" || next.length === 0) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(next);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo returned an invalid pagination link.",
    );
  }
  const cursor =
    parsed.searchParams.get("page[cursor]") ??
    parsed.searchParams.get("page%5Bcursor%5D");
  if (cursor === null || cursor.length === 0) {
    return undefined;
  }
  return validatePaginationCursor(cursor);
}

export function parseKlaviyoListResponse(
  raw: unknown,
  apiHost: string = KLAVIYO_API_HOST,
): {
  data: unknown[];
  nextCursor: string | undefined;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo returned an unexpected list payload.",
    );
  }
  const record = raw as { data?: unknown; links?: unknown };
  const data = Array.isArray(record.data) ? record.data : [];
  const nextCursor = extractCursorFromNextLink(record.links, apiHost);
  return { data, nextCursor };
}
