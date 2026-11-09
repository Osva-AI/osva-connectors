import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_QUERY_TIMEOUT_SECONDS,
  MAX_QUERY_TIMEOUT_SECONDS,
  MIN_QUERY_TIMEOUT_SECONDS,
  SNOWFLAKE_ACCOUNT_ENV,
  SNOWFLAKE_ALLOWED_COLUMNS_ENV,
  SNOWFLAKE_ALLOWED_SCHEMAS_ENV,
  SNOWFLAKE_ALLOWED_TABLES_ENV,
  SNOWFLAKE_DATABASE_ENV,
  SNOWFLAKE_PASSWORD_ENV,
  SNOWFLAKE_QUERY_TIMEOUT_SECONDS_ENV,
  SNOWFLAKE_ROLE_ENV,
  SNOWFLAKE_USER_ENV,
  SNOWFLAKE_WAREHOUSE_ENV,
} from "./constants.js";
import {
  parseAllowedColumnsEnv,
  parseAllowedSchemasEnv,
  parseAllowedTablesEnv,
} from "./resource-scope.js";
import { snowflakeConfigSchema, type SnowflakeConfig } from "./schemas.js";

function readRequiredEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  label: string,
): string {
  const raw = env[key]?.trim();
  if (raw === undefined || raw.length === 0) {
    throw new ConnectorSdkError("CONFIGURATION_ERROR", `${label} is required.`);
  }
  return raw;
}

function readBoundedIntSeconds(
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
  if (value < MIN_QUERY_TIMEOUT_SECONDS || value > MAX_QUERY_TIMEOUT_SECONDS) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} is out of bounds.`,
    );
  }
  return value;
}

export function loadSnowflakeConfig(
  env: NodeJS.ProcessEnv = process.env,
): SnowflakeConfig {
  const queryTimeoutSeconds = readBoundedIntSeconds(
    env[SNOWFLAKE_QUERY_TIMEOUT_SECONDS_ENV],
    DEFAULT_QUERY_TIMEOUT_SECONDS,
    "Query timeout",
  );

  const parsed = snowflakeConfigSchema.safeParse({
    account: readRequiredEnv(env, SNOWFLAKE_ACCOUNT_ENV, "Snowflake account"),
    username: readRequiredEnv(env, SNOWFLAKE_USER_ENV, "Snowflake user"),
    password: readRequiredEnv(
      env,
      SNOWFLAKE_PASSWORD_ENV,
      "Snowflake password",
    ),
    role: readRequiredEnv(env, SNOWFLAKE_ROLE_ENV, "Snowflake role"),
    warehouse: readRequiredEnv(
      env,
      SNOWFLAKE_WAREHOUSE_ENV,
      "Snowflake warehouse",
    ),
    database: readRequiredEnv(
      env,
      SNOWFLAKE_DATABASE_ENV,
      "Snowflake database",
    ),
    queryTimeoutSeconds,
    allowedSchemas: parseAllowedSchemasEnv(env[SNOWFLAKE_ALLOWED_SCHEMAS_ENV]),
    allowedTables: parseAllowedTablesEnv(env[SNOWFLAKE_ALLOWED_TABLES_ENV]),
    allowedColumns: parseAllowedColumnsEnv(env[SNOWFLAKE_ALLOWED_COLUMNS_ENV]),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Snowflake connector configuration is invalid.",
    );
  }

  return parsed.data;
}
