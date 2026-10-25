import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  GSC_SITE_URL_ENV,
  GSC_TIMEOUT_MS_ENV,
} from "./constants.js";
import { gscConfigSchema, type GscConfig } from "./schemas.js";
import { parseSiteUrl } from "./site-url.js";

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

export function loadGscConfig(env: NodeJS.ProcessEnv = process.env): GscConfig {
  const rawSiteUrl = env[GSC_SITE_URL_ENV];
  let defaultSiteUrl: string | undefined;
  if (rawSiteUrl !== undefined && rawSiteUrl.trim().length > 0) {
    try {
      defaultSiteUrl = parseSiteUrl(rawSiteUrl.trim());
    } catch (error) {
      if (error instanceof ConnectorSdkError) {
        throw error;
      }
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Search Console default siteUrl is not valid.",
      );
    }
  }

  const requestTimeoutMs = readBoundedInt(
    env[GSC_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = gscConfigSchema.safeParse({
    defaultSiteUrl,
    requestTimeoutMs,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Search Console connector configuration is invalid.",
    );
  }

  return parsed.data;
}
