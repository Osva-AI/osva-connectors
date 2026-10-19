import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_POOL_MAX,
  DEFAULT_QUERY_TIMEOUT_MS,
  POSTGRES_CONNECT_TIMEOUT_MS_ENV,
  POSTGRES_POOL_MAX_ENV,
  POSTGRES_QUERY_TIMEOUT_MS_ENV,
  POSTGRES_SSL_MODE_ENV,
  POSTGRES_ALLOWED_SCHEMAS_ENV,
  POSTGRES_URL_ENV,
} from "./constants.js";
import { parseAllowedSchemasEnv } from "./allowed-schemas.js";
import { parsePostgresConnectionUrl } from "./parse-connection-url.js";
import { postgresConfigSchema, type PostgresConfig } from "./schemas.js";
import {
  defaultSslModeForHost,
  parsePostgresSslMode,
  type PostgresSslMode,
} from "./ssl.js";

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

function resolveSslMode(env: NodeJS.ProcessEnv, host: string): PostgresSslMode {
  const raw = env[POSTGRES_SSL_MODE_ENV];
  if (raw === undefined || raw.trim().length === 0) {
    return defaultSslModeForHost(host);
  }
  try {
    return parsePostgresSslMode(raw);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "PostgreSQL SSL mode is not supported.",
    );
  }
}

export function loadPostgresConfig(
  env: NodeJS.ProcessEnv = process.env,
): PostgresConfig {
  const rawUrl = env[POSTGRES_URL_ENV];
  if (rawUrl === undefined || rawUrl.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "PostgreSQL connection URL is not configured.",
    );
  }

  let host: string;
  let connectionUrl: string;
  try {
    const parsed = parsePostgresConnectionUrl(rawUrl.trim());
    host = parsed.host;
    connectionUrl = parsed.connectionString;
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "PostgreSQL connection URL is not valid.",
    );
  }

  const sslMode = resolveSslMode(env, host);

  const connectTimeoutMs = readBoundedInt(
    env[POSTGRES_CONNECT_TIMEOUT_MS_ENV],
    DEFAULT_CONNECT_TIMEOUT_MS,
    "Connection timeout",
  );
  const queryTimeoutMs = readBoundedInt(
    env[POSTGRES_QUERY_TIMEOUT_MS_ENV],
    DEFAULT_QUERY_TIMEOUT_MS,
    "Query timeout",
  );
  const poolMax = readBoundedInt(
    env[POSTGRES_POOL_MAX_ENV],
    DEFAULT_POOL_MAX,
    "Pool size",
  );

  const allowedSchemas = parseAllowedSchemasEnv(
    env[POSTGRES_ALLOWED_SCHEMAS_ENV],
  );

  const parsed = postgresConfigSchema.safeParse({
    connectionUrl,
    sslMode,
    connectTimeoutMs,
    queryTimeoutMs,
    poolMax,
    ...(allowedSchemas !== undefined ? { allowedSchemas } : {}),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "PostgreSQL connector configuration is invalid.",
    );
  }

  return parsed.data;
}
