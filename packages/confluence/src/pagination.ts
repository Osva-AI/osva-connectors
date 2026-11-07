import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { validatePaginationCursor } from "./confluence-id.js";
import { MAX_CURSOR_LENGTH } from "./constants.js";

interface ConfluenceLinks {
  readonly next?: string;
}

function normalizeAllowedOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export function assertNextLinkAllowed(
  nextLink: string,
  allowedOrigins: readonly string[],
): void {
  let parsed: URL;
  try {
    parsed =
      nextLink.startsWith("http://") || nextLink.startsWith("https://")
        ? new URL(nextLink)
        : new URL(nextLink, `${allowedOrigins[0]}/`);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence returned an invalid pagination link.",
    );
  }

  const allowed = new Set(
    allowedOrigins.map((origin) => normalizeAllowedOrigin(origin)),
  );

  const linkOrigin = `${parsed.protocol}//${parsed.host}`;
  const isLocalTest =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";

  let matched = false;
  for (const origin of allowed) {
    const originUrl = new URL(origin);
    const allowedOrigin = `${originUrl.protocol}//${originUrl.host}`;
    if (linkOrigin === allowedOrigin) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    if (isLocalTest && [...allowed].some((o) => o.startsWith("http://"))) {
      matched = true;
    }
  }

  if (!matched) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence pagination link host is not allowlisted.",
    );
  }
}

export function extractCursorFromNextLink(
  nextLink: string,
  allowedOrigins: readonly string[],
): string | undefined {
  assertNextLinkAllowed(nextLink, allowedOrigins);
  let parsed: URL;
  try {
    parsed =
      nextLink.startsWith("http://") || nextLink.startsWith("https://")
        ? new URL(nextLink)
        : new URL(nextLink, `${allowedOrigins[0]}/`);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence returned an invalid pagination link.",
    );
  }

  const cursor = parsed.searchParams.get("cursor");
  if (cursor === null || cursor.length === 0) {
    const start = parsed.searchParams.get("start");
    if (start !== null && start.length > 0) {
      return validatePaginationCursor(start);
    }
    return undefined;
  }
  if (cursor.length > MAX_CURSOR_LENGTH) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence pagination cursor is too large.",
    );
  }
  return validatePaginationCursor(cursor);
}

export function parseConfluenceV2ListResponse(
  raw: unknown,
  allowedOrigins: readonly string[],
): {
  readonly results: unknown[];
  readonly nextCursor: string | undefined;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence returned an unexpected list payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const results = Array.isArray(record.results) ? record.results : [];
  const links = record._links as ConfluenceLinks | undefined;
  const next =
    links !== null &&
    typeof links === "object" &&
    typeof links.next === "string"
      ? links.next
      : undefined;
  const nextCursor =
    next !== undefined
      ? extractCursorFromNextLink(next, allowedOrigins)
      : undefined;
  return { results, nextCursor };
}

export function parseConfluenceRestSearchResponse(
  raw: unknown,
  allowedOrigins: readonly string[],
): {
  readonly results: unknown[];
  readonly nextCursor: string | undefined;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Confluence returned an unexpected search payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const results = Array.isArray(record.results) ? record.results : [];

  const links = record._links as ConfluenceLinks | undefined;
  const next =
    links !== null &&
    typeof links === "object" &&
    typeof links.next === "string"
      ? links.next
      : undefined;
  if (next !== undefined) {
    return {
      results,
      nextCursor: extractCursorFromNextLink(next, allowedOrigins),
    };
  }

  const cursor =
    typeof record.cursor === "string" && record.cursor.length > 0
      ? validatePaginationCursor(record.cursor)
      : undefined;
  return { results, nextCursor: cursor };
}
