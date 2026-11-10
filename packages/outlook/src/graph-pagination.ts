import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { GRAPH_API_HOST, MAX_NEXT_LINK_LENGTH } from "./constants.js";

const PRODUCTION_GRAPH_HOST = "graph.microsoft.com";
const GRAPH_V1_PREFIX = "/v1.0/";

export function assertAllowedGraphUrl(url: string, graphApiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph request URL is invalid.",
    );
  }

  const onApi =
    url === graphApiHost ||
    url.startsWith(`${graphApiHost}/`) ||
    url.startsWith(`${graphApiHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph request URL is not allowed.",
    );
  }

  if (graphApiHost === GRAPH_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_GRAPH_HOST) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph request URL is not allowed.",
      );
    }
    if (!parsed.pathname.startsWith(GRAPH_V1_PREFIX)) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph request URL is not allowed.",
      );
    }
    return;
  }

  if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph request URL is not allowed.",
    );
  }
  if (!parsed.pathname.startsWith("/v1.0/")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph request URL is not allowed.",
    );
  }
}

function graphPathSegmentMatches(
  path: string,
  segmentPattern: RegExp,
  expectedRaw: string,
): boolean {
  const match = path.match(segmentPattern);
  if (match === null || match[1] === undefined) {
    return false;
  }
  try {
    return decodeURIComponent(match[1]) === expectedRaw;
  } catch {
    return false;
  }
}

export type OutlookNextLinkResourceBinding =
  | { readonly kind: "mailFolder"; readonly resourceId: string }
  | { readonly kind: "calendar"; readonly resourceId: string };

export function assertNextLinkResourceBinding(
  nextLink: string,
  binding: OutlookNextLinkResourceBinding,
): void {
  const path = decodeURIComponent(new URL(nextLink.trim()).pathname);
  if (binding.kind === "mailFolder") {
    const ok = graphPathSegmentMatches(
      path,
      /\/mailFolders\/([^/]+)\/messages(?:\/|$)/,
      binding.resourceId,
    );
    if (!ok) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "nextLink is not bound to the requested mail folder.",
      );
    }
    return;
  }
  const ok = graphPathSegmentMatches(
    path,
    /\/calendars\/([^/]+)\/events(?:\/|$)/,
    binding.resourceId,
  );
  if (!ok) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "nextLink is not bound to the requested calendar.",
    );
  }
}

export function assertNextLinkResourceScope(
  nextLink: string,
  pathPatterns: readonly RegExp[],
): void {
  let parsed: URL;
  try {
    parsed = new URL(nextLink.trim());
  } catch {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid nextLink.");
  }
  const path = decodeURIComponent(parsed.pathname);
  if (!pathPatterns.some((pattern) => pattern.test(path))) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "nextLink is not valid for this operation.",
    );
  }
}

export const OUTLOOK_NEXT_LINK_SCOPES = {
  mailFolders: [/\/mailFolders(?:\/|$)/],
  messages: [/\/messages(?:\/|$)/, /\/mailFolders\/[^/]+\/messages(?:\/|$)/],
  calendars: [/\/calendars(?:\/|$)/],
  events: [/\/events(?:\/|$)/, /\/calendars\/[^/]+\/events(?:\/|$)/],
} as const satisfies Record<string, readonly RegExp[]>;

export function validateNextLinkInput(
  nextLink: string | undefined,
  graphApiHost: string,
  resourceScope?: readonly RegExp[],
  resourceBinding?: OutlookNextLinkResourceBinding,
): string | undefined {
  if (nextLink === undefined) {
    return undefined;
  }
  const trimmed = nextLink.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid nextLink.");
  }
  if (trimmed.length > MAX_NEXT_LINK_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid nextLink.");
  }
  assertAllowedGraphUrl(trimmed, graphApiHost);
  if (resourceScope !== undefined && resourceScope.length > 0) {
    assertNextLinkResourceScope(trimmed, resourceScope);
  }
  if (resourceBinding !== undefined) {
    assertNextLinkResourceBinding(trimmed, resourceBinding);
  }
  return trimmed;
}

export function extractODataNextLink(
  raw: unknown,
  graphApiHost: string,
): string | undefined {
  if (raw === null || typeof raw !== "object") {
    return undefined;
  }
  const next = (raw as Record<string, unknown>)["@odata.nextLink"];
  if (typeof next !== "string" || next.trim().length === 0) {
    return undefined;
  }
  const trimmed = next.trim();
  if (trimmed.length > MAX_NEXT_LINK_LENGTH) {
    return undefined;
  }
  assertAllowedGraphUrl(trimmed, graphApiHost);
  return trimmed;
}
