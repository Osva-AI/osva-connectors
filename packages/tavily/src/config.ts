import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  TAVILY_API_KEY_ENV,
  TAVILY_TIMEOUT_MS_ENV,
} from "./constants.js";
import { tavilyConfigSchema, type TavilyConfig } from "./schemas.js";

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

export function loadTavilyConfig(
  env: NodeJS.ProcessEnv = process.env,
): TavilyConfig {
  const rawKey = env[TAVILY_API_KEY_ENV];
  if (rawKey === undefined || rawKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Tavily API key is required.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[TAVILY_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = tavilyConfigSchema.safeParse({
    apiKey: rawKey.trim(),
    requestTimeoutMs,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Tavily connector configuration is invalid.",
    );
  }

  return parsed.data;
}
