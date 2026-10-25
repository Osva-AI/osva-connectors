import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { normalizeSiteUrlInput, parseSiteUrl } from "./site-url.js";

export function resolveSiteUrl(
  input: string | undefined,
  defaultSiteUrl: string | undefined,
): string {
  const normalized = normalizeSiteUrlInput(input) ?? defaultSiteUrl;
  if (normalized === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "siteUrl is required when OSVA_CONNECTOR_GSC_SITE_URL is not set.",
    );
  }
  return parseSiteUrl(normalized);
}
