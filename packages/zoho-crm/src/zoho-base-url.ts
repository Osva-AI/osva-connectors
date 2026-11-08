import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { ZOHO_CRM_API_VERSION_PATH } from "./constants.js";

const REGION_ORIGINS: Record<string, string> = {
  us: "https://www.zohoapis.com",
  eu: "https://www.zohoapis.eu",
  in: "https://www.zohoapis.in",
  au: "https://www.zohoapis.com.au",
  jp: "https://www.zohoapis.jp",
  uk: "https://www.zohoapis.uk",
  ca: "https://www.zohoapis.ca",
};

export interface ZohoBaseUrlParseResult {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
}

export function parseZohoRegion(
  rawRegion: string,
  allowTestApiHost: boolean,
): ZohoBaseUrlParseResult {
  const region = rawRegion.trim().toLowerCase();
  const origin = REGION_ORIGINS[region];
  if (origin === undefined) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zoho CRM region must be us, eu, in, au, jp, uk, or ca.",
    );
  }
  if (
    !allowTestApiHost &&
    (origin.includes("127.0.0.1") || origin.includes("localhost"))
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Local Zoho CRM hosts require allow-test flag.",
    );
  }
  const apiBaseUrl = `${origin}${ZOHO_CRM_API_VERSION_PATH}`;
  return { apiBaseUrl, pinnedOrigin: origin };
}
