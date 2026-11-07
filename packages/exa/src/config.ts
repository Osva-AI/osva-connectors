import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  EXA_API_KEY_ENV,
  EXA_TIMEOUT_MS_ENV,
} from "./constants.js";
import { exaConfigSchema, type ExaConfig } from "./schemas.js";

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

export function loadExaConfig(env: NodeJS.ProcessEnv = process.env): ExaConfig {
  const rawKey = env[EXA_API_KEY_ENV];
  if (rawKey === undefined || rawKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Exa API key is not configured.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[EXA_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = exaConfigSchema.safeParse({
    apiKey: rawKey.trim(),
    requestTimeoutMs,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Exa connector configuration is invalid.",
    );
  }

  return parsed.data;
}
