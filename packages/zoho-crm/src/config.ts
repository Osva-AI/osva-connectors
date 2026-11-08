import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  ZOHO_ACCESS_TOKEN_ENV,
  ZOHO_ALLOW_TEST_API_HOST_ENV,
  ZOHO_ALLOWED_DEAL_IDS_ENV,
  ZOHO_ALLOWED_TARGET_STAGES_ENV,
  ZOHO_API_BASE_URL_ENV,
  ZOHO_HOST_WRITES_APPROVED_ENV,
  ZOHO_INCLUDE_PII_ENV,
  ZOHO_NOTES_ENABLED_ENV,
  ZOHO_REGION_ENV,
  ZOHO_STAGE_UPDATES_ENABLED_ENV,
  ZOHO_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseStringIdList } from "./id-allowlist.js";
import { parseZohoRegion } from "./zoho-base-url.js";
import { zohoConfigSchema, type ZohoConfig } from "./schemas.js";

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

export function loadZohoConfig(
  env: NodeJS.ProcessEnv = process.env,
): ZohoConfig {
  const rawToken = env[ZOHO_ACCESS_TOKEN_ENV];
  const rawRegion = env[ZOHO_REGION_ENV];
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zoho CRM access token is not configured.",
    );
  }
  if (rawRegion === undefined || rawRegion.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zoho CRM region is not configured.",
    );
  }
  const allowTestApiHost = parseBooleanFlag(
    env[ZOHO_ALLOW_TEST_API_HOST_ENV],
    false,
  );
  const rawApiBase = env[ZOHO_API_BASE_URL_ENV]?.trim();
  let apiBaseUrl: string;
  let pinnedOrigin: string;
  if (rawApiBase !== undefined && rawApiBase.length > 0) {
    if (!allowTestApiHost) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Custom API base URL requires OSVA_CONNECTOR_ZOHO_CRM_ALLOW_TEST_API_HOST=true.",
      );
    }
    const parsedUrl = new URL(rawApiBase);
    apiBaseUrl = parsedUrl.toString().replace(/\/$/, "");
    pinnedOrigin = parsedUrl.origin;
  } else {
    ({ apiBaseUrl, pinnedOrigin } = parseZohoRegion(
      rawRegion,
      allowTestApiHost,
    ));
  }
  const parsed = zohoConfigSchema.safeParse({
    apiBaseUrl,
    pinnedOrigin,
    accessToken: rawToken.trim(),
    allowTestApiHost,
    allowedDealIds: parseStringIdList(env[ZOHO_ALLOWED_DEAL_IDS_ENV]),
    allowedTargetStages: parseCsvStrings(env[ZOHO_ALLOWED_TARGET_STAGES_ENV]),
    notesEnabled: parseBooleanFlag(env[ZOHO_NOTES_ENABLED_ENV], false),
    stageUpdatesEnabled: parseBooleanFlag(
      env[ZOHO_STAGE_UPDATES_ENABLED_ENV],
      false,
    ),
    hostWritesApproved: parseBooleanFlag(
      env[ZOHO_HOST_WRITES_APPROVED_ENV],
      false,
    ),
    includePii: parseBooleanFlag(env[ZOHO_INCLUDE_PII_ENV], false),
    requestTimeoutMs: readBoundedInt(
      env[ZOHO_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Zoho CRM connector configuration is invalid.",
    );
  }
  return parsed.data;
}
