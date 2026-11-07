import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  ATLASSIAN_API_HOST,
  DEFAULT_REQUEST_TIMEOUT_MS,
  JIRA_ACCESS_TOKEN_ENV,
  JIRA_ALLOWED_PROJECT_KEYS_ENV,
  JIRA_API_TOKEN_ENV,
  JIRA_CLOUD_ID_ENV,
  JIRA_EMAIL_ENV,
  JIRA_HOST_WRITES_APPROVED_ENV,
  JIRA_SITE_URL_ENV,
  JIRA_TIMEOUT_MS_ENV,
  JIRA_WRITE_ENABLED_ENV,
} from "./constants.js";
import { parseProjectKey } from "./jira-id.js";
import { jiraConfigSchema, type JiraConfig } from "./schemas.js";

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

function parseBooleanFlag(raw: string | undefined, fallback: false): boolean {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Boolean environment flag must be true or false.",
  );
}

/**
 * `undefined` — env var absent: no allowlist (all project keys allowed for reads).
 * `[]` — env var present but empty/whitespace-only: explicit deny-all allowlist.
 */
function parseAllowedProjectKeys(
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
  for (const p of parts) {
    const key = parseProjectKey(p, "project key");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(key);
  }
  return out;
}

function normalizeSiteUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Jira site URL is invalid.",
    );
  }
  if (url.protocol !== "https:") {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Jira site URL must use HTTPS.",
    );
  }
  if (!url.hostname.endsWith(".atlassian.net")) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Jira site URL hostname must be a *.atlassian.net host.",
    );
  }
  return `${url.protocol}//${url.host}`;
}

function resolveApiBaseAndAuth(env: NodeJS.ProcessEnv): {
  readonly apiBasePath: string;
  readonly authorizationHeader: string;
  readonly credentialForRedaction: string;
} {
  const cloudId = env[JIRA_CLOUD_ID_ENV]?.trim();
  const accessToken = env[JIRA_ACCESS_TOKEN_ENV]?.trim();
  const siteUrlRaw = env[JIRA_SITE_URL_ENV]?.trim();
  const email = env[JIRA_EMAIL_ENV]?.trim();
  const apiToken = env[JIRA_API_TOKEN_ENV]?.trim();

  if (cloudId !== undefined && cloudId.length > 0) {
    if (accessToken === undefined || accessToken.length === 0) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Atlassian cloud ID auth requires OSVA_CONNECTOR_JIRA_ACCESS_TOKEN.",
      );
    }
    const apiBasePath = `${ATLASSIAN_API_HOST}/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3`;
    return {
      apiBasePath,
      authorizationHeader: `Bearer ${accessToken}`,
      credentialForRedaction: accessToken,
    };
  }

  if (siteUrlRaw === undefined || siteUrlRaw.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Jira site URL or cloud ID is required.",
    );
  }

  const siteOrigin = normalizeSiteUrl(siteUrlRaw);
  const apiBasePath = `${siteOrigin}/rest/api/3`;

  if (
    email !== undefined &&
    email.length > 0 &&
    apiToken !== undefined &&
    apiToken.length > 0
  ) {
    const basic = Buffer.from(`${email}:${apiToken}`, "utf8").toString(
      "base64",
    );
    return {
      apiBasePath,
      authorizationHeader: `Basic ${basic}`,
      credentialForRedaction: apiToken,
    };
  }

  if (accessToken !== undefined && accessToken.length > 0) {
    return {
      apiBasePath,
      authorizationHeader: `Bearer ${accessToken}`,
      credentialForRedaction: accessToken,
    };
  }

  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Jira credentials are required: email+API token or access token.",
  );
}

export function loadJiraConfig(
  env: NodeJS.ProcessEnv = process.env,
): JiraConfig {
  const auth = resolveApiBaseAndAuth(env);

  const requestTimeoutMs = readBoundedInt(
    env[JIRA_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const writeEnabled = parseBooleanFlag(env[JIRA_WRITE_ENABLED_ENV], false);
  const hostWritesApproved = parseBooleanFlag(
    env[JIRA_HOST_WRITES_APPROVED_ENV],
    false,
  );
  const allowedProjectKeys = parseAllowedProjectKeys(
    env[JIRA_ALLOWED_PROJECT_KEYS_ENV],
  );

  const parsed = jiraConfigSchema.safeParse({
    apiBasePath: auth.apiBasePath,
    authorizationHeader: auth.authorizationHeader,
    credentialForRedaction: auth.credentialForRedaction,
    requestTimeoutMs,
    writeEnabled,
    hostWritesApproved,
    allowedProjectKeys,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Jira connector configuration is invalid.",
    );
  }

  return parsed.data;
}
