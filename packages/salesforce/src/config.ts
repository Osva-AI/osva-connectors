import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SALESFORCE_API_VERSION,
  SALESFORCE_ACCESS_TOKEN_ENV,
  SALESFORCE_ALLOW_TEST_API_HOST_ENV,
  SALESFORCE_ALLOWED_OPPORTUNITY_IDS_ENV,
  SALESFORCE_ALLOWED_TASK_PARENT_IDS_ENV,
  SALESFORCE_ALLOWED_TARGET_STAGES_ENV,
  SALESFORCE_API_VERSION_ENV,
  SALESFORCE_HOST_WRITES_APPROVED_ENV,
  SALESFORCE_INCLUDE_PII_ENV,
  SALESFORCE_INSTANCE_URL_ENV,
  SALESFORCE_STAGE_UPDATES_ENABLED_ENV,
  SALESFORCE_TASKS_ENABLED_ENV,
  SALESFORCE_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseStringIdList } from "./id-allowlist.js";
import {
  buildSalesforceApiDataBaseUrl,
  parseSalesforceApiVersion,
  parseSalesforceInstanceUrl,
} from "./salesforce-base-url.js";
import { salesforceConfigSchema, type SalesforceConfig } from "./schemas.js";

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

export function loadSalesforceConfig(
  env: NodeJS.ProcessEnv = process.env,
): SalesforceConfig {
  const rawInstance = env[SALESFORCE_INSTANCE_URL_ENV];
  const rawToken = env[SALESFORCE_ACCESS_TOKEN_ENV];
  if (rawInstance === undefined || rawInstance.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Salesforce instance URL is not configured.",
    );
  }
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Salesforce access token is not configured.",
    );
  }
  const allowTestApiHost = parseBooleanFlag(
    env[SALESFORCE_ALLOW_TEST_API_HOST_ENV],
    false,
  );
  const { instanceUrl, pinnedOrigin } = parseSalesforceInstanceUrl(
    rawInstance,
    allowTestApiHost,
  );
  const apiVersion = parseSalesforceApiVersion(
    env[SALESFORCE_API_VERSION_ENV] ?? DEFAULT_SALESFORCE_API_VERSION,
  );
  const apiDataBaseUrl = buildSalesforceApiDataBaseUrl(instanceUrl, apiVersion);
  const parsed = salesforceConfigSchema.safeParse({
    instanceUrl,
    pinnedOrigin,
    apiDataBaseUrl,
    apiVersion,
    accessToken: rawToken.trim(),
    allowTestApiHost,
    allowedOpportunityIds: parseStringIdList(
      env[SALESFORCE_ALLOWED_OPPORTUNITY_IDS_ENV],
    ),
    allowedTaskParentIds: parseStringIdList(
      env[SALESFORCE_ALLOWED_TASK_PARENT_IDS_ENV],
    ),
    allowedTargetStages: parseCsvStrings(
      env[SALESFORCE_ALLOWED_TARGET_STAGES_ENV],
    ),
    stageUpdatesEnabled: parseBooleanFlag(
      env[SALESFORCE_STAGE_UPDATES_ENABLED_ENV],
      false,
    ),
    tasksEnabled: parseBooleanFlag(env[SALESFORCE_TASKS_ENABLED_ENV], false),
    hostWritesApproved: parseBooleanFlag(
      env[SALESFORCE_HOST_WRITES_APPROVED_ENV],
      false,
    ),
    includePii: parseBooleanFlag(env[SALESFORCE_INCLUDE_PII_ENV], false),
    requestTimeoutMs: readBoundedInt(
      env[SALESFORCE_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Salesforce connector configuration is invalid.",
    );
  }
  return parsed.data;
}
