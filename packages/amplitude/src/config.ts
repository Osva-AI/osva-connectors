import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { resolveAmplitudeApiHost } from "./amplitude-host.js";
import {
  AMPLITUDE_ALLOWED_CHART_IDS_ENV,
  AMPLITUDE_API_KEY_ENV,
  AMPLITUDE_REGION_ENV,
  AMPLITUDE_SECRET_KEY_ENV,
  AMPLITUDE_TIMEOUT_MS_ENV,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./constants.js";
import { amplitudeConfigSchema, type AmplitudeConfig } from "./schemas.js";

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

function parseAllowedChartIds(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of parts) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parseRegion(raw: string | undefined): "us" | "eu" {
  if (raw === undefined || raw.trim().length === 0) {
    return "us";
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "us" || normalized === "eu") {
    return normalized;
  }
  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Amplitude region must be us or eu.",
  );
}

export function loadAmplitudeConfig(
  env: NodeJS.ProcessEnv = process.env,
): AmplitudeConfig {
  const rawApiKey = env[AMPLITUDE_API_KEY_ENV];
  const rawSecretKey = env[AMPLITUDE_SECRET_KEY_ENV];
  if (rawApiKey === undefined || rawApiKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Amplitude API key is not configured.",
    );
  }
  if (rawSecretKey === undefined || rawSecretKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Amplitude secret key is not configured.",
    );
  }

  const region = parseRegion(env[AMPLITUDE_REGION_ENV]);
  const apiHost = resolveAmplitudeApiHost(region);
  const requestTimeoutMs = readBoundedInt(
    env[AMPLITUDE_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const allowedChartIds = parseAllowedChartIds(
    env[AMPLITUDE_ALLOWED_CHART_IDS_ENV],
  );

  const parsed = amplitudeConfigSchema.safeParse({
    apiKey: rawApiKey.trim(),
    secretKey: rawSecretKey.trim(),
    region,
    apiHost,
    requestTimeoutMs,
    ...(allowedChartIds !== undefined ? { allowedChartIds } : {}),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Amplitude connector configuration is invalid.",
    );
  }

  return parsed.data;
}
