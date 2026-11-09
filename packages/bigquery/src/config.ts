import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_LOCATION,
  DEFAULT_MAX_BYTES_BILLED,
  DEFAULT_QUERY_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  BIGQUERY_ALLOWED_DATASETS_ENV,
  BIGQUERY_ALLOWED_TABLES_ENV,
  BIGQUERY_LOCATION_ENV,
  BIGQUERY_MAX_BYTES_BILLED_ENV,
  BIGQUERY_PROJECT_ID_ENV,
  BIGQUERY_QUERY_TIMEOUT_MS_ENV,
  BIGQUERY_REQUEST_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseAllowedDatasets, parseAllowedTables } from "./resource-scope.js";
import { bigqueryConfigSchema, type BigqueryConfig } from "./schemas.js";

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

export function loadBigqueryConfig(
  env: NodeJS.ProcessEnv = process.env,
): BigqueryConfig {
  const projectId = env[BIGQUERY_PROJECT_ID_ENV]?.trim();
  if (projectId === undefined || projectId.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigQuery project id is required (OSVA_CONNECTOR_BIGQUERY_PROJECT_ID).",
    );
  }

  const location = env[BIGQUERY_LOCATION_ENV]?.trim() ?? DEFAULT_LOCATION;

  const queryTimeoutMs = readBoundedInt(
    env[BIGQUERY_QUERY_TIMEOUT_MS_ENV],
    DEFAULT_QUERY_TIMEOUT_MS,
    "Query timeout",
  );

  const requestTimeoutMs = readBoundedInt(
    env[BIGQUERY_REQUEST_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const maxBytesBilled = readBoundedInt(
    env[BIGQUERY_MAX_BYTES_BILLED_ENV],
    DEFAULT_MAX_BYTES_BILLED,
    "Max bytes billed",
  );

  const parsed = bigqueryConfigSchema.safeParse({
    projectId,
    location,
    queryTimeoutMs,
    requestTimeoutMs,
    maxBytesBilled,
    allowedDatasets: parseAllowedDatasets(env[BIGQUERY_ALLOWED_DATASETS_ENV]),
    allowedTables: parseAllowedTables(
      env[BIGQUERY_ALLOWED_TABLES_ENV],
      "OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES",
    ),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigQuery connector configuration is invalid.",
    );
  }

  return parsed.data;
}
