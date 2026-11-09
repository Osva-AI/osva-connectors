import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  GCS_ACCOUNT_WIDE_BUCKET_DISCOVERY_ENV,
  GCS_ALLOWED_BUCKETS_READ_ENV,
  GCS_ALLOWED_BUCKETS_WRITE_ENV,
  GCS_CREATE_ENABLED_ENV,
  GCS_HOST_WRITES_APPROVED_ENV,
  GCS_PROJECT_ID_ENV,
  GCS_REPLACE_ENABLED_ENV,
  GCS_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseBucketScopeMap } from "./resource-scope.js";
import { gcsConfigSchema, type GcsConfig } from "./schemas.js";

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

function parseBooleanFlag(raw: string | undefined, fallback: false): boolean {
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

export function loadGcsConfig(env: NodeJS.ProcessEnv = process.env): GcsConfig {
  const projectId = env[GCS_PROJECT_ID_ENV]?.trim();
  if (projectId === undefined || projectId.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "GCS project id is required (OSVA_CONNECTOR_GCS_PROJECT_ID).",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[GCS_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = gcsConfigSchema.safeParse({
    projectId,
    requestTimeoutMs,
    allowedBucketsRead: parseBucketScopeMap(
      env[GCS_ALLOWED_BUCKETS_READ_ENV],
      "OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_READ",
    ),
    allowedBucketsWrite: parseBucketScopeMap(
      env[GCS_ALLOWED_BUCKETS_WRITE_ENV],
      "OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_WRITE",
    ),
    accountWideBucketDiscovery: parseBooleanFlag(
      env[GCS_ACCOUNT_WIDE_BUCKET_DISCOVERY_ENV],
      false,
    ),
    createEnabled: parseBooleanFlag(env[GCS_CREATE_ENABLED_ENV], false),
    replaceEnabled: parseBooleanFlag(env[GCS_REPLACE_ENABLED_ENV], false),
    hostWritesApproved: parseBooleanFlag(
      env[GCS_HOST_WRITES_APPROVED_ENV],
      false,
    ),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "GCS connector configuration is invalid.",
    );
  }

  return parsed.data;
}
