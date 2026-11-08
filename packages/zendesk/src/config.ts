import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  ZENDESK_ALLOW_TEST_API_HOST_ENV,
  ZENDESK_ALLOWED_TARGET_STATUSES_ENV,
  ZENDESK_ALLOWED_RESOURCE_IDS_ENV,
  ZENDESK_API_TOKEN_ENV,
  ZENDESK_EMAIL_ENV,
  ZENDESK_HOST_WRITES_APPROVED_ENV,
  ZENDESK_INCLUDE_PII_ENV,
  ZENDESK_INCLUDE_REQUESTER_PII_ENV,
  ZENDESK_NOTES_ENABLED_ENV,
  ZENDESK_STATUS_ENABLED_ENV,
  ZENDESK_API_BASE_URL_ENV,
  ZENDESK_SUBDOMAIN_ENV,
  ZENDESK_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseNumericIdList } from "./id-allowlist.js";
import { zendeskConfigSchema, type ZendeskConfig } from "./schemas.js";
import { parseZendeskSubdomain } from "./zendesk-base-url.js";

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

function parseBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
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

function parseCsvStrings(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function loadZendeskConfig(
  env: NodeJS.ProcessEnv = process.env,
): ZendeskConfig {
  const rawSubdomain = env[ZENDESK_SUBDOMAIN_ENV];
  const rawEmail = env[ZENDESK_EMAIL_ENV];
  const rawToken = env[ZENDESK_API_TOKEN_ENV];
  if (rawSubdomain === undefined || rawSubdomain.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zendesk subdomain is not configured.",
    );
  }
  if (rawEmail === undefined || rawEmail.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zendesk agent email is not configured.",
    );
  }
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zendesk API token is not configured.",
    );
  }
  const allowTestApiHost = parseBooleanFlag(
    env[ZENDESK_ALLOW_TEST_API_HOST_ENV],
    false,
  );
  const rawApiBase = env[ZENDESK_API_BASE_URL_ENV]?.trim();
  let apiBaseUrl: string;
  let pinnedOrigin: string;
  if (rawApiBase !== undefined && rawApiBase.length > 0) {
    if (!allowTestApiHost) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Custom API base URL requires OSVA_CONNECTOR_ZENDESK_ALLOW_TEST_API_HOST=true.",
      );
    }
    const parsedUrl = new URL(rawApiBase);
    apiBaseUrl = parsedUrl.toString().replace(/\/$/, "");
    pinnedOrigin = parsedUrl.origin;
  } else {
    ({ apiBaseUrl, pinnedOrigin } = parseZendeskSubdomain(
      rawSubdomain,
      allowTestApiHost,
    ));
  }
  const parsed = zendeskConfigSchema.safeParse({
    apiBaseUrl,
    pinnedOrigin,
    email: rawEmail.trim(),
    apiToken: rawToken.trim(),
    allowTestApiHost,
    allowedResourceIds: parseNumericIdList(
      env[ZENDESK_ALLOWED_RESOURCE_IDS_ENV] ??
        env.OSVA_CONNECTOR_ZENDESK_ALLOWED_TICKET_IDS,
    ),
    allowedTargetStatuses: parseCsvStrings(
      env[ZENDESK_ALLOWED_TARGET_STATUSES_ENV],
    ),
    notesEnabled: parseBooleanFlag(env[ZENDESK_NOTES_ENABLED_ENV], false),
    statusEnabled: parseBooleanFlag(env[ZENDESK_STATUS_ENABLED_ENV], false),
    hostWritesApproved: parseBooleanFlag(
      env[ZENDESK_HOST_WRITES_APPROVED_ENV],
      false,
    ),
    includePii: parseBooleanFlag(
      env[ZENDESK_INCLUDE_PII_ENV] ?? env[ZENDESK_INCLUDE_REQUESTER_PII_ENV],
      false,
    ),
    requestTimeoutMs: readBoundedInt(
      env[ZENDESK_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zendesk connector configuration is invalid.",
    );
  }
  return parsed.data;
}
