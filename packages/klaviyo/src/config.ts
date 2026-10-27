import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_MAX_ROWS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  KLAVIYO_MAX_ROWS_ENV,
  KLAVIYO_PRIVATE_API_KEY_ENV,
  KLAVIYO_TIMEOUT_MS_ENV,
} from "./constants.js";
import { klaviyoConfigSchema, type KlaviyoConfig } from "./schemas.js";

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

export function loadKlaviyoConfig(
  env: NodeJS.ProcessEnv = process.env,
): KlaviyoConfig {
  const rawKey = env[KLAVIYO_PRIVATE_API_KEY_ENV];
  if (rawKey === undefined || rawKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Klaviyo private API key is not configured.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[KLAVIYO_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const maxRows = readBoundedInt(
    env[KLAVIYO_MAX_ROWS_ENV],
    DEFAULT_MAX_ROWS,
    "Max rows",
  );

  const parsed = klaviyoConfigSchema.safeParse({
    privateApiKey: rawKey.trim(),
    requestTimeoutMs,
    maxRows,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Klaviyo connector configuration is invalid.",
    );
  }

  return parsed.data;
}
