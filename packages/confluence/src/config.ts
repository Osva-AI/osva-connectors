import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  ATLASSIAN_GATEWAY_ORIGIN,
  CONFLUENCE_ACCESS_TOKEN_ENV,
  CONFLUENCE_ALLOWED_SPACE_IDS_ENV,
  CONFLUENCE_API_TOKEN_ENV,
  CONFLUENCE_CLOUD_ID_ENV,
  CONFLUENCE_EMAIL_ENV,
  CONFLUENCE_HOST_WRITES_APPROVED_ENV,
  CONFLUENCE_SITE_URL_ENV,
  CONFLUENCE_TIMEOUT_MS_ENV,
  CONFLUENCE_WRITE_ENABLED_ENV,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./constants.js";
import { parseConfluenceId } from "./confluence-id.js";
import { confluenceConfigSchema, type ConfluenceConfig } from "./schemas.js";

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
 * `undefined` — env var absent: no allowlist (all space ids allowed for reads).
 * `[]` — env var present but empty/whitespace-only: explicit deny-all allowlist.
 */
function parseAllowedSpaceIds(raw: string | undefined): string[] | undefined {
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
  for (const part of parts) {
    const id = parseConfluenceId(part, "space ID");
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeSiteUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Confluence site URL is invalid.",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Confluence site URL must use HTTPS.",
    );
  }
  return trimmed;
}

function resolveApiBases(env: NodeJS.ProcessEnv): {
  readonly apiBaseV2: string;
  readonly apiBaseRest: string;
} {
  const cloudId = env[CONFLUENCE_CLOUD_ID_ENV]?.trim();
  const accessToken = env[CONFLUENCE_ACCESS_TOKEN_ENV]?.trim();

  if (cloudId !== undefined && cloudId.length > 0) {
    if (accessToken === undefined || accessToken.length === 0) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Confluence OAuth access token is required when cloud ID is set.",
      );
    }
    const base = `${ATLASSIAN_GATEWAY_ORIGIN}/ex/confluence/${cloudId}`;
    return {
      apiBaseV2: `${base}/wiki/api/v2`,
      apiBaseRest: `${base}/wiki/rest/api`,
    };
  }

  const siteRaw = env[CONFLUENCE_SITE_URL_ENV];
  if (siteRaw === undefined || siteRaw.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Confluence site URL or cloud ID is required.",
    );
  }
  const site = normalizeSiteUrl(siteRaw);
  return {
    apiBaseV2: `${site}/wiki/api/v2`,
    apiBaseRest: `${site}/wiki/rest/api`,
  };
}

function resolveAuth(env: NodeJS.ProcessEnv): {
  readonly authorizationHeader: string;
  readonly credentialForRedaction: string;
} {
  const accessToken = env[CONFLUENCE_ACCESS_TOKEN_ENV]?.trim();
  const email = env[CONFLUENCE_EMAIL_ENV]?.trim();
  const apiToken = env[CONFLUENCE_API_TOKEN_ENV]?.trim();

  if (accessToken !== undefined && accessToken.length > 0) {
    return {
      authorizationHeader: `Bearer ${accessToken}`,
      credentialForRedaction: accessToken,
    };
  }

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
      authorizationHeader: `Basic ${basic}`,
      credentialForRedaction: apiToken,
    };
  }

  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Confluence credentials are required (API token + email, or OAuth access token).",
  );
}

export function loadConfluenceConfig(
  env: NodeJS.ProcessEnv = process.env,
): ConfluenceConfig {
  const bases = resolveApiBases(env);
  const auth = resolveAuth(env);

  const requestTimeoutMs = readBoundedInt(
    env[CONFLUENCE_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const writeEnabled = parseBooleanFlag(
    env[CONFLUENCE_WRITE_ENABLED_ENV],
    false,
  );
  const hostWritesApproved = parseBooleanFlag(
    env[CONFLUENCE_HOST_WRITES_APPROVED_ENV],
    false,
  );
  const allowedSpaceIds = parseAllowedSpaceIds(
    env[CONFLUENCE_ALLOWED_SPACE_IDS_ENV],
  );

  const parsed = confluenceConfigSchema.safeParse({
    apiBaseV2: bases.apiBaseV2,
    apiBaseRest: bases.apiBaseRest,
    authorizationHeader: auth.authorizationHeader,
    credentialForRedaction: auth.credentialForRedaction,
    requestTimeoutMs,
    writeEnabled,
    hostWritesApproved,
    allowedSpaceIds,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Confluence connector configuration is invalid.",
    );
  }

  return parsed.data;
}
