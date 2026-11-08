import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { SALESFORCE_PRODUCTION_HOST_SUFFIXES } from "./constants.js";

export interface SalesforceInstanceParseResult {
  readonly instanceUrl: string;
  readonly pinnedOrigin: string;
}

function isProductionSalesforceHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return SALESFORCE_PRODUCTION_HOST_SUFFIXES.some((suffix) =>
    lower.endsWith(suffix),
  );
}

export function parseSalesforceApiVersion(raw: string | undefined): string {
  if (raw === undefined || raw.trim().length === 0) {
    return "v59.0";
  }
  const version = raw.trim();
  if (!/^v\d{1,3}\.\d+$/.test(version)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Salesforce API version is invalid.",
    );
  }
  return version;
}

export function parseSalesforceInstanceUrl(
  rawInstanceUrl: string,
  allowTestApiHost: boolean,
): SalesforceInstanceParseResult {
  const trimmed = rawInstanceUrl.trim();
  if (trimmed.length === 0 || trimmed.length > 256) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Salesforce instance URL is invalid.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Salesforce instance URL is invalid.",
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Salesforce instance URL must use http or https.",
    );
  }
  const isLocal =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname.endsWith(".localhost");
  if (isLocal) {
    if (!allowTestApiHost) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Local Salesforce instance hosts require OSVA_CONNECTOR_SALESFORCE_ALLOW_TEST_API_HOST=true.",
      );
    }
  } else if (
    !allowTestApiHost &&
    !isProductionSalesforceHost(parsed.hostname)
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Salesforce instance host is not a recognized production domain.",
    );
  }
  const pinnedOrigin = parsed.origin;
  const instanceUrl = `${pinnedOrigin}${parsed.pathname.replace(/\/$/, "")}`;
  return { instanceUrl, pinnedOrigin };
}

export function buildSalesforceApiDataBaseUrl(
  instanceUrl: string,
  apiVersion: string,
): string {
  const base = instanceUrl.replace(/\/$/, "");
  return `${base}/services/data/${apiVersion}`;
}
