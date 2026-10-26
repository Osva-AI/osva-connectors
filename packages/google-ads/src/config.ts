import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_MAX_ROWS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  GOOGLE_ADS_ALLOWED_CUSTOMERS_ENV,
  GOOGLE_ADS_DEVELOPER_TOKEN_ENV,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID_ENV,
  GOOGLE_ADS_MAX_ROWS_ENV,
  GOOGLE_ADS_TIMEOUT_MS_ENV,
} from "./constants.js";
import { normalizeCustomerIdInput } from "./customer-id.js";
import { googleAdsConfigSchema, type GoogleAdsConfig } from "./schemas.js";

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be an integer.`,
    );
  }
  return value;
}

function parseAllowedCustomerIds(
  raw: string | undefined,
): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    let normalized: string;
    try {
      normalized = normalizeCustomerIdInput(part);
    } catch {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowed customer list contains an invalid customer ID.",
      );
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

function parseOptionalCustomerId(
  raw: string | undefined,
  label: string,
): string | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  try {
    return normalizeCustomerIdInput(raw.trim());
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} is not a valid 10-digit customer ID.`,
    );
  }
}

export function loadGoogleAdsConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleAdsConfig {
  const loginCustomerId = parseOptionalCustomerId(
    env[GOOGLE_ADS_LOGIN_CUSTOMER_ID_ENV],
    "Login customer ID",
  );
  const allowedCustomerIds = parseAllowedCustomerIds(
    env[GOOGLE_ADS_ALLOWED_CUSTOMERS_ENV],
  );
  const requestTimeoutMs = readBoundedInt(
    env[GOOGLE_ADS_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const maxRows = readBoundedInt(
    env[GOOGLE_ADS_MAX_ROWS_ENV],
    DEFAULT_MAX_ROWS,
    "Max rows",
  );
  const developerTokenRaw = env[GOOGLE_ADS_DEVELOPER_TOKEN_ENV];
  const developerToken =
    developerTokenRaw !== undefined && developerTokenRaw.trim().length > 0
      ? developerTokenRaw.trim()
      : undefined;

  const parsed = googleAdsConfigSchema.safeParse({
    loginCustomerId,
    allowedCustomerIds,
    requestTimeoutMs,
    maxRows,
    developerToken,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Google Ads connector configuration is invalid.",
    );
  }

  return parsed.data;
}
