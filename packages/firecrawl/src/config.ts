import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  FIRECRAWL_API_KEY_ENV,
  FIRECRAWL_TIMEOUT_MS_ENV,
} from "./constants.js";
import { firecrawlConfigSchema, type FirecrawlConfig } from "./schemas.js";

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

export function loadFirecrawlConfig(
  env: NodeJS.ProcessEnv = process.env,
): FirecrawlConfig {
  const apiKey = env[FIRECRAWL_API_KEY_ENV]?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Firecrawl API key is required.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[FIRECRAWL_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = firecrawlConfigSchema.safeParse({
    apiKey,
    requestTimeoutMs,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Firecrawl connector configuration is invalid.",
    );
  }

  return parsed.data;
}
