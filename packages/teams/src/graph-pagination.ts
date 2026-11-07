import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { GRAPH_API_HOST, MAX_ODATA_LINK_LENGTH } from "./constants.js";
import { validateODataNextLink } from "./teams-id.js";

function normalizeGraphBase(base: string): string {
  return base.replace(/\/$/, "");
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

export const TEAMS_NEXT_LINK_SCOPES = {
  joinedTeams: [/\/joinedTeams(?:\/|$)/],
  channels: [/\/teams\/[^/]+\/channels(?:\/|$)/],
  channelMessages: [/\/teams\/[^/]+\/channels\/[^/]+\/messages(?:\/|$)/],
  channelReplies: [
    /\/teams\/[^/]+\/channels\/[^/]+\/messages\/[^/]+\/replies(?:\/|$)/,
  ],
  chats: [/\/chats(?:\/|$)/],
  chatMessages: [/\/chats\/[^/]+\/messages(?:\/|$)/],
} as const satisfies Record<string, readonly RegExp[]>;

export function assertGraphNextLinkAllowed(
  nextLink: string,
  graphApiBase: string,
): void {
  const validated = validateODataNextLink(nextLink);
  if (validated === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an invalid pagination link.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(validated);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an invalid pagination link.",
    );
  }

  const configured = new URL(normalizeGraphBase(graphApiBase));
  const linkOrigin = `${parsed.protocol}//${parsed.host}`;
  const allowedOrigin = `${configured.protocol}//${configured.host}`;

  const isLocal =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";

  if (linkOrigin === allowedOrigin) {
    if (!parsed.pathname.startsWith("/v1.0/") && !isLocal) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph pagination link path is not allowed.",
      );
    }
    return;
  }

  if (isLocal && configured.hostname === "127.0.0.1") {
    return;
  }

  if (graphApiBase === GRAPH_API_HOST) {
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "graph.microsoft.com"
    ) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph pagination link host is not allowlisted.",
      );
    }
    return;
  }

  throw new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Microsoft Graph pagination link host is not allowlisted.",
  );
}

export function parseGraphListResponse(
  raw: unknown,
  graphApiBase: string,
): {
  readonly value: unknown[];
  readonly nextLink: string | undefined;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected list payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const value = Array.isArray(record.value) ? record.value : [];
  const next =
    typeof record["@odata.nextLink"] === "string"
      ? record["@odata.nextLink"]
      : undefined;
  let nextLink: string | undefined;
  if (next !== undefined) {
    if (next.length > MAX_ODATA_LINK_LENGTH) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph pagination link is too large.",
      );
    }
    assertGraphNextLinkAllowed(next, graphApiBase);
    nextLink = validateODataNextLink(next);
  }
  return { value, nextLink };
}

export function validateTeamsNextLinkInput(
  nextLink: string | undefined,
  graphApiBase: string,
  resourceScope: readonly RegExp[],
): string | undefined {
  if (nextLink === undefined) {
    return undefined;
  }
  assertGraphNextLinkAllowed(nextLink, graphApiBase);
  assertNextLinkResourceScope(nextLink, resourceScope);
  return nextLink.trim();
}
