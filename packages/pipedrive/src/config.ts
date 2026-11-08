import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  PIPEDRIVE_ALLOW_TEST_API_HOST_ENV,
  PIPEDRIVE_ALLOWED_DEAL_IDS_ENV,
  PIPEDRIVE_ALLOWED_STAGE_IDS_ENV,
  PIPEDRIVE_API_BASE_URL_ENV,
  PIPEDRIVE_API_TOKEN_ENV,
  PIPEDRIVE_COMPANY_DOMAIN_ENV,
  PIPEDRIVE_HOST_WRITES_APPROVED_ENV,
  PIPEDRIVE_INCLUDE_PII_ENV,
  PIPEDRIVE_STAGE_UPDATES_ENABLED_ENV,
  PIPEDRIVE_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseNumericIdList } from "./id-allowlist.js";
import { parsePipedriveCompanyDomain } from "./pipedrive-base-url.js";
import { pipedriveConfigSchema, type PipedriveConfig } from "./schemas.js";

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

export function loadPipedriveConfig(
  env: NodeJS.ProcessEnv = process.env,
): PipedriveConfig {
  const rawDomain = env[PIPEDRIVE_COMPANY_DOMAIN_ENV];
  const rawToken = env[PIPEDRIVE_API_TOKEN_ENV];
  if (rawDomain === undefined || rawDomain.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Pipedrive company domain is not configured.",
    );
  }
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Pipedrive API token is not configured.",
    );
  }
  const allowTestApiHost = parseBooleanFlag(
    env[PIPEDRIVE_ALLOW_TEST_API_HOST_ENV],
    false,
  );
  const rawApiBase = env[PIPEDRIVE_API_BASE_URL_ENV]?.trim();
  let apiBaseUrl: string;
  let pinnedOrigin: string;
  if (rawApiBase !== undefined && rawApiBase.length > 0) {
    if (!allowTestApiHost) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Custom API base URL requires OSVA_CONNECTOR_PIPEDRIVE_ALLOW_TEST_API_HOST=true.",
      );
    }
    const parsedUrl = new URL(rawApiBase);
    apiBaseUrl = parsedUrl.toString().replace(/\/$/, "");
    pinnedOrigin = parsedUrl.origin;
  } else {
    ({ apiBaseUrl, pinnedOrigin } = parsePipedriveCompanyDomain(
      rawDomain,
      allowTestApiHost,
    ));
  }
  const parsed = pipedriveConfigSchema.safeParse({
    apiBaseUrl,
    pinnedOrigin,
    apiToken: rawToken.trim(),
    allowTestApiHost,
    allowedDealIds: parseNumericIdList(env[PIPEDRIVE_ALLOWED_DEAL_IDS_ENV]),
    allowedStageIds: parseNumericIdList(env[PIPEDRIVE_ALLOWED_STAGE_IDS_ENV]),
    stageUpdatesEnabled: parseBooleanFlag(
      env[PIPEDRIVE_STAGE_UPDATES_ENABLED_ENV],
      false,
    ),
    hostWritesApproved: parseBooleanFlag(
      env[PIPEDRIVE_HOST_WRITES_APPROVED_ENV],
      false,
    ),
    includePii: parseBooleanFlag(env[PIPEDRIVE_INCLUDE_PII_ENV], false),
    requestTimeoutMs: readBoundedInt(
      env[PIPEDRIVE_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Pipedrive connector configuration is invalid.",
    );
  }
  return parsed.data;
}
