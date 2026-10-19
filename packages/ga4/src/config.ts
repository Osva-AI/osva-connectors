import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  GA4_PROPERTY_ID_ENV,
  GA4_TIMEOUT_MS_ENV,
} from "./constants.js";
import { normalizePropertyIdInput } from "./property-id.js";
import { ga4ConfigSchema, type Ga4Config } from "./schemas.js";

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

export function loadGa4Config(env: NodeJS.ProcessEnv = process.env): Ga4Config {
  const rawPropertyId = env[GA4_PROPERTY_ID_ENV];
  let defaultPropertyId: string | undefined;
  if (rawPropertyId !== undefined && rawPropertyId.trim().length > 0) {
    try {
      defaultPropertyId = normalizePropertyIdInput(rawPropertyId.trim());
    } catch (error) {
      if (error instanceof ConnectorSdkError) {
        throw error;
      }
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "GA4 default property ID is not valid.",
      );
    }
  }

  const requestTimeoutMs = readBoundedInt(
    env[GA4_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = ga4ConfigSchema.safeParse({
    defaultPropertyId,
    requestTimeoutMs,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "GA4 connector configuration is invalid.",
    );
  }

  return parsed.data;
}
