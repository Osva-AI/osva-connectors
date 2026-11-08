import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  FRESHDESK_ALLOW_TEST_API_HOST_ENV,
  FRESHDESK_ALLOWED_RESOURCE_IDS_ENV,
  FRESHDESK_ALLOWED_TARGET_STATUSES_ENV,
  FRESHDESK_API_BASE_URL_ENV,
  FRESHDESK_API_KEY_ENV,
  FRESHDESK_DOMAIN_ENV,
  FRESHDESK_HOST_WRITES_APPROVED_ENV,
  FRESHDESK_INCLUDE_PII_ENV,
  FRESHDESK_NOTES_ENABLED_ENV,
  FRESHDESK_STATUS_ENABLED_ENV,
  FRESHDESK_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseNumericIdList } from "./id-allowlist.js";
import { parseFreshdeskDomain } from "./freshdesk-base-url.js";
import { freshdeskConfigSchema, type FreshdeskConfig } from "./schemas.js";

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw.trim().length === 0) return fallback;
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
  if (raw === undefined || raw.trim().length === 0) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Boolean environment flag must be true or false.",
  );
}

function parseCsvStrings(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  if (raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function loadFreshdeskConfig(
  env: NodeJS.ProcessEnv = process.env,
): FreshdeskConfig {
  const rawDomain = env[FRESHDESK_DOMAIN_ENV];
  const rawKey = env[FRESHDESK_API_KEY_ENV];
  if (rawDomain === undefined || rawDomain.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Freshdesk domain is not configured.",
    );
  }
  if (rawKey === undefined || rawKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Freshdesk API key is not configured.",
    );
  }
  const allowTestApiHost = parseBooleanFlag(
    env[FRESHDESK_ALLOW_TEST_API_HOST_ENV],
    false,
  );
  const rawApiBase = env[FRESHDESK_API_BASE_URL_ENV]?.trim();
  let apiBaseUrl: string;
  let pinnedOrigin: string;
  if (rawApiBase !== undefined && rawApiBase.length > 0) {
    if (!allowTestApiHost) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Custom API base URL requires OSVA_CONNECTOR_FRESHDESK_ALLOW_TEST_API_HOST=true.",
      );
    }
    const parsedUrl = new URL(rawApiBase);
    apiBaseUrl = parsedUrl.toString().replace(/\/$/, "");
    pinnedOrigin = parsedUrl.origin;
  } else {
    ({ apiBaseUrl, pinnedOrigin } = parseFreshdeskDomain(
      rawDomain,
      allowTestApiHost,
    ));
  }
  const parsed = freshdeskConfigSchema.safeParse({
    apiBaseUrl,
    pinnedOrigin,
    apiKey: rawKey.trim(),
    allowTestApiHost,
    allowedResourceIds: parseNumericIdList(
      env[FRESHDESK_ALLOWED_RESOURCE_IDS_ENV],
    ),
    allowedTargetStatuses: parseCsvStrings(
      env[FRESHDESK_ALLOWED_TARGET_STATUSES_ENV],
    ),
    notesEnabled: parseBooleanFlag(env[FRESHDESK_NOTES_ENABLED_ENV], false),
    statusEnabled: parseBooleanFlag(env[FRESHDESK_STATUS_ENABLED_ENV], false),
    hostWritesApproved: parseBooleanFlag(
      env[FRESHDESK_HOST_WRITES_APPROVED_ENV],
      false,
    ),
    includePii: parseBooleanFlag(env[FRESHDESK_INCLUDE_PII_ENV], false),
    requestTimeoutMs: readBoundedInt(
      env[FRESHDESK_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Freshdesk connector configuration is invalid.",
    );
  }
  return parsed.data;
}
