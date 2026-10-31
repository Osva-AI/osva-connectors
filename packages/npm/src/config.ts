import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_NPM_USER_AGENT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  NPM_TIMEOUT_MS_ENV,
} from "./constants.js";

export interface NpmConnectorConfig {
  readonly requestTimeoutMs: number;
  readonly userAgent: string;
}

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  label: string,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be an integer between ${min} and ${max}.`,
    );
  }
  return value;
}

export function loadNpmConfig(
  env: NodeJS.ProcessEnv = process.env,
): NpmConnectorConfig {
  const requestTimeoutMs = readBoundedInt(
    env[NPM_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
    MIN_REQUEST_TIMEOUT_MS,
    MAX_REQUEST_TIMEOUT_MS,
  );

  return {
    requestTimeoutMs,
    userAgent: DEFAULT_NPM_USER_AGENT,
  };
}
