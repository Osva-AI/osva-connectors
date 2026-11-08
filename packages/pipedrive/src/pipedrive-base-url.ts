import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { PRODUCTION_API_HOST_SUFFIX } from "./constants.js";

export interface PipedriveBaseUrlParseResult {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
}

export function parsePipedriveCompanyDomain(
  rawDomain: string,
  allowTestApiHost: boolean,
): PipedriveBaseUrlParseResult {
  const trimmed = rawDomain.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Pipedrive company domain is invalid.",
    );
  }
  let host: string;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (!allowTestApiHost) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Custom Pipedrive URL requires OSVA_CONNECTOR_PIPEDRIVE_ALLOW_TEST_API_HOST=true.",
      );
    }
    host = new URL(trimmed).host;
  } else {
    const domain = trimmed.toLowerCase().replace(/\.pipedrive\.com$/i, "");
    host = `${domain}${PRODUCTION_API_HOST_SUFFIX}`;
  }
  const pinnedOrigin = trimmed.startsWith("http")
    ? new URL(trimmed).origin
    : `https://${host}`;
  if (
    !allowTestApiHost &&
    (pinnedOrigin.includes("127.0.0.1") || pinnedOrigin.includes("localhost"))
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Local Pipedrive hosts require OSVA_CONNECTOR_PIPEDRIVE_ALLOW_TEST_API_HOST=true.",
    );
  }
  return {
    apiBaseUrl: `${pinnedOrigin}/api/v2`,
    pinnedOrigin,
  };
}
