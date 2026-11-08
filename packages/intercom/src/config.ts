import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  INTERCOM_ACCESS_TOKEN_ENV,
  INTERCOM_ADMIN_ID_ENV,
  INTERCOM_ALLOW_TEST_API_HOST_ENV,
  INTERCOM_ALLOWED_RESOURCE_IDS_ENV,
  INTERCOM_ALLOWED_TARGET_STATUSES_ENV,
  INTERCOM_API_BASE_URL_ENV,
  INTERCOM_HOST_WRITES_APPROVED_ENV,
  INTERCOM_INCLUDE_PII_ENV,
  INTERCOM_NOTES_ENABLED_ENV,
  INTERCOM_REGION_ENV,
  INTERCOM_STATUS_ENABLED_ENV,
  INTERCOM_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseStringIdList } from "./id-allowlist.js";
import { parseIntercomRegion } from "./intercom-base-url.js";
import { intercomConfigSchema, type IntercomConfig } from "./schemas.js";

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

export function loadIntercomConfig(
  env: NodeJS.ProcessEnv = process.env,
): IntercomConfig {
  const rawToken = env[INTERCOM_ACCESS_TOKEN_ENV];
  const rawRegion = env[INTERCOM_REGION_ENV];
  const rawAdminId = env[INTERCOM_ADMIN_ID_ENV];
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Intercom access token is not configured.",
    );
  }
  if (rawRegion === undefined || rawRegion.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Intercom region is not configured.",
    );
  }
  if (rawAdminId === undefined || rawAdminId.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Intercom admin id is not configured.",
    );
  }
  const allowTestApiHost = parseBooleanFlag(
    env[INTERCOM_ALLOW_TEST_API_HOST_ENV],
    false,
  );
  const rawApiBase = env[INTERCOM_API_BASE_URL_ENV]?.trim();
  let apiBaseUrl: string;
  let pinnedOrigin: string;
  if (rawApiBase !== undefined && rawApiBase.length > 0) {
    if (!allowTestApiHost) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Custom API base URL requires OSVA_CONNECTOR_INTERCOM_ALLOW_TEST_API_HOST=true.",
      );
    }
    const parsedUrl = new URL(rawApiBase);
    apiBaseUrl = parsedUrl.toString().replace(/\/$/, "");
    pinnedOrigin = parsedUrl.origin;
  } else {
    ({ apiBaseUrl, pinnedOrigin } = parseIntercomRegion(
      rawRegion,
      allowTestApiHost,
    ));
  }
  const parsed = intercomConfigSchema.safeParse({
    apiBaseUrl,
    pinnedOrigin,
    accessToken: rawToken.trim(),
    adminId: rawAdminId.trim(),
    allowTestApiHost,
    allowedResourceIds: parseStringIdList(
      env[INTERCOM_ALLOWED_RESOURCE_IDS_ENV],
    ),
    allowedTargetStatuses: parseCsvStrings(
      env[INTERCOM_ALLOWED_TARGET_STATUSES_ENV],
    ),
    notesEnabled: parseBooleanFlag(env[INTERCOM_NOTES_ENABLED_ENV], false),
    statusEnabled: parseBooleanFlag(env[INTERCOM_STATUS_ENABLED_ENV], false),
    hostWritesApproved: parseBooleanFlag(
      env[INTERCOM_HOST_WRITES_APPROVED_ENV],
      false,
    ),
    includePii: parseBooleanFlag(env[INTERCOM_INCLUDE_PII_ENV], false),
    requestTimeoutMs: readBoundedInt(
      env[INTERCOM_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Intercom connector configuration is invalid.",
    );
  }
  return parsed.data;
}
