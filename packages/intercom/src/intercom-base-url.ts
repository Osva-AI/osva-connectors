import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const REGION_ORIGINS: Record<string, string> = {
  us: "https://api.intercom.io",
  eu: "https://api.eu.intercom.io",
  au: "https://api.au.intercom.io",
};

export interface IntercomBaseUrlParseResult {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
}

export function parseIntercomRegion(
  rawRegion: string,
  allowTestApiHost: boolean,
): IntercomBaseUrlParseResult {
  const region = rawRegion.trim().toLowerCase();
  const origin = REGION_ORIGINS[region];
  if (origin === undefined) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Intercom region must be us, eu, or au.",
    );
  }
  if (
    !allowTestApiHost &&
    (origin.includes("127.0.0.1") || origin.includes("localhost"))
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Local Intercom hosts require allow-test flag.",
    );
  }
  return { apiBaseUrl: origin, pinnedOrigin: origin };
}
