import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_CURSOR_LENGTH, STRIPE_API_HOST } from "./constants.js";
import { parseStripeResourceId } from "./resource-id.js";

const CURSOR_PATTERN = /^[A-Za-z0-9_]{1,512}$/;

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
  try {
    return parseStripeResourceId(trimmed, "Pagination cursor");
  } catch {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Pagination cursor is not valid.",
    );
  }
}

export interface StripeListPayload {
  readonly object?: string;
  readonly data?: unknown;
  readonly has_more?: boolean;
  readonly url?: string;
}

/**
 * Rejects following provider-supplied list URLs; validates host when present.
 */
export function assertStripeListUrlSafe(
  listUrl: unknown,
  apiHost: string,
): void {
  if (typeof listUrl !== "string" || listUrl.length === 0) {
    return;
  }
  if (listUrl.startsWith("/")) {
    if (!listUrl.startsWith("/v1/")) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Stripe list URL path is not supported.",
      );
    }
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(listUrl);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe returned an invalid list URL.",
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
      "Stripe list URL host is not allowlisted.",
    );
  }
  if (!parsed.pathname.startsWith("/v1/")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe list URL path is not supported.",
    );
  }
}

export function parseStripeListResponse(
  raw: unknown,
  apiHost: string = STRIPE_API_HOST,
): {
  data: unknown[];
  hasMore: boolean;
  lastId: string | undefined;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe returned an unexpected list payload.",
    );
  }
  const record = raw as StripeListPayload;
  assertStripeListUrlSafe(record.url, apiHost);
  const data = Array.isArray(record.data) ? record.data : [];
  const hasMore = record.has_more === true;
  let lastId: string | undefined;
  if (data.length > 0) {
    const last = data[data.length - 1];
    if (last !== null && typeof last === "object" && "id" in last) {
      const id = (last as { id?: unknown }).id;
      if (typeof id === "string" && id.length > 0) {
        lastId = validatePaginationCursor(id);
      }
    }
  }
  return { data, hasMore, lastId };
}

export function nextCursorFromList(
  hasMore: boolean,
  lastId: string | undefined,
): string | undefined {
  if (!hasMore || lastId === undefined) {
    return undefined;
  }
  return lastId;
}
