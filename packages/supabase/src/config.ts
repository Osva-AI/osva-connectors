import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  parseAllowedSchemasEnv,
  parseAllowedTablesEnv,
} from "./allowed-tables.js";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  SUPABASE_ALLOW_TEST_API_HOST_ENV,
  SUPABASE_ALLOWED_SCHEMAS_ENV,
  SUPABASE_ALLOWED_TABLES_ENV,
  SUPABASE_COUNT_EXACT_ENABLED_ENV,
  SUPABASE_PROJECT_URL_ENV,
  SUPABASE_PUBLISHABLE_KEY_ENV,
  SUPABASE_TIMEOUT_MS_ENV,
  SUPABASE_USER_ACCESS_TOKEN_ENV,
} from "./constants.js";
import { assertSupabaseCredentialNotPrivileged } from "./jwt-policy.js";
import { parseSupabaseProjectUrl } from "./project-url.js";
import { supabaseConfigSchema, type SupabaseConfig } from "./schemas.js";

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

export function loadSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseConfig {
  const rawUrl = env[SUPABASE_PROJECT_URL_ENV];
  if (rawUrl === undefined || rawUrl.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Supabase project URL is not configured.",
    );
  }
  const rawPublishable = env[SUPABASE_PUBLISHABLE_KEY_ENV];
  if (rawPublishable === undefined || rawPublishable.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Supabase publishable key is not configured.",
    );
  }
  const rawUserToken = env[SUPABASE_USER_ACCESS_TOKEN_ENV];
  if (rawUserToken === undefined || rawUserToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Supabase user access token is not configured.",
    );
  }
  const allowTestApiHost = parseBooleanFlag(
    env[SUPABASE_ALLOW_TEST_API_HOST_ENV],
    false,
  );
  const publishableKey = rawPublishable.trim();
  const userAccessToken = rawUserToken.trim();
  assertSupabaseCredentialNotPrivileged(
    publishableKey,
    "Supabase publishable key",
  );
  assertSupabaseCredentialNotPrivileged(
    userAccessToken,
    "Supabase user access token",
  );

  const { projectUrl, pinnedOrigin, restBaseUrl, projectRef } =
    parseSupabaseProjectUrl(rawUrl, allowTestApiHost);

  const parsed = supabaseConfigSchema.safeParse({
    projectUrl,
    pinnedOrigin,
    restBaseUrl,
    projectRef,
    publishableKey,
    userAccessToken,
    allowTestApiHost,
    allowedSchemas: parseAllowedSchemasEnv(env[SUPABASE_ALLOWED_SCHEMAS_ENV]),
    allowedTables: parseAllowedTablesEnv(env[SUPABASE_ALLOWED_TABLES_ENV]),
    requestTimeoutMs: readBoundedInt(
      env[SUPABASE_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
    countExactEnabled: parseBooleanFlag(
      env[SUPABASE_COUNT_EXACT_ENABLED_ENV],
      false,
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Supabase connector configuration is invalid.",
    );
  }
  return parsed.data;
}
