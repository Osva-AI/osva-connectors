import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { PRODUCTION_API_HOST_SUFFIX } from "./constants.js";

export interface ZendeskBaseUrlParseResult {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
}

export function parseZendeskSubdomain(
  rawSubdomain: string,
  allowTestApiHost: boolean,
): ZendeskBaseUrlParseResult {
  const subdomain = rawSubdomain.trim().toLowerCase();
  if (subdomain.length === 0 || subdomain.length > 64) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zendesk subdomain is invalid.",
    );
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zendesk subdomain format is invalid.",
    );
  }
  const host = `${subdomain}${PRODUCTION_API_HOST_SUFFIX}`;
  const pinnedOrigin = `https://${host}`;
  if (
    !allowTestApiHost &&
    (host.includes("127.0.0.1") || host.includes("localhost"))
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Local Zendesk hosts require OSVA_CONNECTOR_ZENDESK_ALLOW_TEST_API_HOST=true.",
    );
  }
  return {
    apiBaseUrl: `${pinnedOrigin}/api/v2`,
    pinnedOrigin,
  };
}
