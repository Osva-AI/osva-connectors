import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GRAPH_API_HOST,
  MAX_DRIVE_ID_LENGTH,
  MAX_ITEM_ID_LENGTH,
  MAX_NEXT_LINK_LENGTH,
  PRODUCTION_GRAPH_HOSTNAME,
} from "./constants.js";

const DRIVE_ID_PATTERN = /^[a-zA-Z0-9!._-]+$/;
const ITEM_ID_PATTERN = /^[a-zA-Z0-9!._-]+$/;

export function parseDriveId(value: string, label: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_DRIVE_ID_LENGTH ||
    !DRIVE_ID_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  return trimmed;
}

export function parseItemId(value: string, label: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_ITEM_ID_LENGTH ||
    !ITEM_ID_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", `Invalid ${label}.`);
  }
  return trimmed;
}

export function assertSafeUploadFilename(filename: string): string {
  const trimmed = filename.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid file name.");
  }
  if (
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("..") ||
    trimmed.includes("\0")
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "File name must not contain path segments.",
    );
  }
  const base = trimmed.replace(/^.*[/\\]/, "");
  if (base.length === 0 || base === "." || base === "..") {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid file name.");
  }
  return base;
}

export function assertNextLinkResourceScope(
  nextLink: string,
  pathPatterns: readonly RegExp[],
): void {
  let parsed: URL;
  try {
    parsed = new URL(nextLink.trim());
  } catch {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid OneDrive nextLink.");
  }
  const path = decodeURIComponent(parsed.pathname);
  if (!pathPatterns.some((pattern) => pattern.test(path))) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "nextLink is not valid for this operation.",
    );
  }
}

export const ONEDRIVE_NEXT_LINK_SCOPES = {
  driveChildren: [
    /\/me\/drive\/.*\/children(?:\/|$)/,
    /\/drives\/[^/]+\/items\/[^/]+\/children(?:\/|$)/,
    /\/me\/drive\/root(?:\/|$)/,
  ],
  driveSearch: [/\/search\(/, /\/me\/drive\/.*\/search/],
} as const satisfies Record<string, readonly RegExp[]>;

export function validateGraphNextLink(
  nextLink: string,
  graphApiHost: string,
  resourceScope?: readonly RegExp[],
): string {
  const trimmed = nextLink.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NEXT_LINK_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid OneDrive nextLink.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid OneDrive nextLink.");
  }

  if (graphApiHost === GRAPH_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Invalid OneDrive nextLink.",
      );
    }
    if (parsed.hostname !== PRODUCTION_GRAPH_HOSTNAME) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Invalid OneDrive nextLink.",
      );
    }
    if (!parsed.pathname.startsWith("/v1.0/")) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Invalid OneDrive nextLink.",
      );
    }
  } else {
    if (
      parsed.hostname !== "127.0.0.1" &&
      parsed.hostname !== "localhost" &&
      parsed.protocol !== "http:"
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Invalid OneDrive nextLink.",
      );
    }
    if (!parsed.pathname.startsWith("/v1.0/")) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Invalid OneDrive nextLink.",
      );
    }
  }
  if (resourceScope !== undefined && resourceScope.length > 0) {
    assertNextLinkResourceScope(trimmed, resourceScope);
  }
  return trimmed;
}

export function assertAllowedGraphRequestUrl(
  url: string,
  graphApiHost: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive request URL is invalid.",
    );
  }

  const hostNoTrail = graphApiHost.replace(/\/$/, "");
  if (url !== hostNoTrail && !url.startsWith(`${hostNoTrail}/`)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive request URL is not allowed.",
    );
  }

  if (graphApiHost === GRAPH_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "OneDrive request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_GRAPH_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "OneDrive request URL is not allowed.",
      );
    }
    if (!parsed.pathname.startsWith("/v1.0/")) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "OneDrive request URL is not allowed.",
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
      "OneDrive request URL is not allowed.",
    );
  }
  if (!parsed.pathname.startsWith("/v1.0/")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive request URL is not allowed.",
    );
  }
}
