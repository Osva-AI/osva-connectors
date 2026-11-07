import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MIXPANEL_ALLOWED_BOOKMARK_IDS_ENV,
  MIXPANEL_ALLOWED_FUNNEL_IDS_ENV,
  MIXPANEL_PROJECT_ID_ENV,
  MIXPANEL_REGION_ENV,
  MIXPANEL_SERVICE_ACCOUNT_SECRET_ENV,
  MIXPANEL_SERVICE_ACCOUNT_USERNAME_ENV,
  MIXPANEL_TIMEOUT_MS_ENV,
  MIXPANEL_WORKSPACE_ID_ENV,
} from "./constants.js";
import { parseMixpanelRegion } from "./mixpanel-region.js";
import { mixpanelConfigSchema, type MixpanelConfig } from "./schemas.js";

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

function readRequiredPositiveInt(
  raw: string | undefined,
  label: string,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    throw new ConnectorSdkError("CONFIGURATION_ERROR", `${label} is required.`);
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be a positive integer.`,
    );
  }
  return value;
}

function parseAllowedResourceIds(
  raw: string | undefined,
): string[] | undefined {
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

function readRequiredSecret(raw: string | undefined, label: string): string {
  if (raw === undefined || raw.trim().length === 0) {
    throw new ConnectorSdkError("CONFIGURATION_ERROR", `${label} is required.`);
  }
  return raw.trim();
}

export function loadMixpanelConfig(
  env: NodeJS.ProcessEnv = process.env,
): MixpanelConfig {
  const serviceAccountUsername = readRequiredSecret(
    env[MIXPANEL_SERVICE_ACCOUNT_USERNAME_ENV],
    "Mixpanel service account username",
  );
  const serviceAccountSecret = readRequiredSecret(
    env[MIXPANEL_SERVICE_ACCOUNT_SECRET_ENV],
    "Mixpanel service account secret",
  );
  const projectId = readRequiredPositiveInt(
    env[MIXPANEL_PROJECT_ID_ENV],
    "Mixpanel project ID",
  );
  const region = parseMixpanelRegion(env[MIXPANEL_REGION_ENV]);

  const rawWorkspace = env[MIXPANEL_WORKSPACE_ID_ENV];
  let workspaceId: number | undefined;
  if (rawWorkspace !== undefined && rawWorkspace.trim().length > 0) {
    const value = Number(rawWorkspace.trim());
    if (!Number.isInteger(value) || value <= 0) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Mixpanel workspace ID must be a positive integer.",
      );
    }
    workspaceId = value;
  }

  const requestTimeoutMs = readBoundedInt(
    env[MIXPANEL_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const allowedBookmarkIds = parseAllowedResourceIds(
    env[MIXPANEL_ALLOWED_BOOKMARK_IDS_ENV],
  );
  const allowedFunnelIds = parseAllowedResourceIds(
    env[MIXPANEL_ALLOWED_FUNNEL_IDS_ENV],
  );

  const parsed = mixpanelConfigSchema.safeParse({
    serviceAccountUsername,
    serviceAccountSecret,
    projectId,
    region,
    ...(workspaceId !== undefined ? { workspaceId } : {}),
    ...(allowedBookmarkIds !== undefined ? { allowedBookmarkIds } : {}),
    ...(allowedFunnelIds !== undefined ? { allowedFunnelIds } : {}),
    requestTimeoutMs,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Mixpanel connector configuration is invalid.",
    );
  }

  return parsed.data;
}
