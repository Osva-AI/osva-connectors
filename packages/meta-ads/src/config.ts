import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { normalizeAccountIdInput } from "./account-id.js";
import {
  DEFAULT_MAX_ROWS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  META_ADS_ACCESS_TOKEN_ENV,
  META_ADS_ALLOWED_ACCOUNTS_ENV,
  META_ADS_APP_SECRET_ENV,
  META_ADS_MAX_ROWS_ENV,
  META_ADS_TIMEOUT_MS_ENV,
} from "./constants.js";
import { metaAdsConfigSchema, type MetaAdsConfig } from "./schemas.js";

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

function parseAllowedAccountIds(raw: string | undefined): string[] | undefined {
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
      normalized = normalizeAccountIdInput(part);
    } catch {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowed account list contains an invalid ad account ID.",
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

export function loadMetaAdsConfig(
  env: NodeJS.ProcessEnv = process.env,
): MetaAdsConfig {
  const rawToken = env[META_ADS_ACCESS_TOKEN_ENV];
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Meta Ads access token is not configured.",
    );
  }

  const appSecretRaw = env[META_ADS_APP_SECRET_ENV];
  const appSecret =
    appSecretRaw !== undefined && appSecretRaw.trim().length > 0
      ? appSecretRaw.trim()
      : undefined;

  const allowedAccountIds = parseAllowedAccountIds(
    env[META_ADS_ALLOWED_ACCOUNTS_ENV],
  );
  const requestTimeoutMs = readBoundedInt(
    env[META_ADS_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const maxRows = readBoundedInt(
    env[META_ADS_MAX_ROWS_ENV],
    DEFAULT_MAX_ROWS,
    "Max rows",
  );

  const parsed = metaAdsConfigSchema.safeParse({
    accessToken: rawToken.trim(),
    appSecret,
    allowedAccountIds,
    requestTimeoutMs,
    maxRows,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Meta Ads connector configuration is invalid.",
    );
  }

  return parsed.data;
}
