import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_MAX_ROWS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  HUBSPOT_ACCESS_TOKEN_ENV,
  HUBSPOT_ALLOWED_OBJECT_TYPES_ENV,
  HUBSPOT_INCLUDE_PII_ENV,
  HUBSPOT_MAX_ROWS_ENV,
  HUBSPOT_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseAllowedObjectTypes } from "./property-allowlist.js";
import { hubspotConfigSchema, type HubspotConfig } from "./schemas.js";

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

function readIncludePii(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim().length === 0) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Include PII flag must be true or false.",
  );
}

export function loadHubspotConfig(
  env: NodeJS.ProcessEnv = process.env,
): HubspotConfig {
  const rawToken = env[HUBSPOT_ACCESS_TOKEN_ENV];
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "HubSpot access token is not configured.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[HUBSPOT_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const maxRows = readBoundedInt(
    env[HUBSPOT_MAX_ROWS_ENV],
    DEFAULT_MAX_ROWS,
    "Max rows",
  );
  const allowedObjectTypes = parseAllowedObjectTypes(
    env[HUBSPOT_ALLOWED_OBJECT_TYPES_ENV],
  );
  const includePii = readIncludePii(env[HUBSPOT_INCLUDE_PII_ENV]);

  const parsed = hubspotConfigSchema.safeParse({
    accessToken: rawToken.trim(),
    requestTimeoutMs,
    maxRows,
    allowedObjectTypes,
    includePii,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "HubSpot connector configuration is invalid.",
    );
  }

  return parsed.data;
}
