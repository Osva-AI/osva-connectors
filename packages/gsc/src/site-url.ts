import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_SITE_URL_LENGTH } from "./constants.js";

const DOMAIN_PROPERTY =
  /^sc-domain:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

function isValidUrlPrefix(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.username.length > 0 || parsed.password.length > 0) {
      return false;
    }
    if (parsed.hostname.length === 0) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeSiteUrlInput(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

export function parseSiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SITE_URL_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Search Console siteUrl is not valid.",
    );
  }
  if (trimmed.startsWith("sc-domain:")) {
    if (!DOMAIN_PROPERTY.test(trimmed)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Search Console domain property must match sc-domain:hostname.",
      );
    }
    return trimmed;
  }
  if (!isValidUrlPrefix(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Search Console URL-prefix property must be an http(s) site URL.",
    );
  }
  return trimmed;
}

/** Encode a site URL for use as a single Webmasters API path segment. */
export function encodeSiteUrlForApiPath(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

/** Encode a sitemap feed path for Webmasters API path segment. */
export function encodeSitemapFeedPath(sitemapUrl: string): string {
  return encodeURIComponent(sitemapUrl);
}
