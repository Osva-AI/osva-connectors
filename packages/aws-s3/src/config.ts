import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  S3_ACCOUNT_WIDE_BUCKET_DISCOVERY_ENV,
  S3_ALLOWED_BUCKETS_READ_ENV,
  S3_ALLOWED_BUCKETS_WRITE_ENV,
  S3_CREATE_ENABLED_ENV,
  S3_HOST_WRITES_APPROVED_ENV,
  S3_REGION_ENV,
  S3_REPLACE_ENABLED_ENV,
  S3_TIMEOUT_MS_ENV,
} from "./constants.js";
import { parseBucketScopeMap } from "./resource-scope.js";
import { s3ConfigSchema, type S3Config } from "./schemas.js";

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

export function loadS3Config(env: NodeJS.ProcessEnv = process.env): S3Config {
  const region = env[S3_REGION_ENV]?.trim();
  if (region === undefined || region.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "AWS S3 region is required (OSVA_CONNECTOR_S3_REGION).",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[S3_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = s3ConfigSchema.safeParse({
    region,
    requestTimeoutMs,
    allowedBucketsRead: parseBucketScopeMap(
      env[S3_ALLOWED_BUCKETS_READ_ENV],
      "OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ",
    ),
    allowedBucketsWrite: parseBucketScopeMap(
      env[S3_ALLOWED_BUCKETS_WRITE_ENV],
      "OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_WRITE",
    ),
    accountWideBucketDiscovery: parseBooleanFlag(
      env[S3_ACCOUNT_WIDE_BUCKET_DISCOVERY_ENV],
      false,
    ),
    createEnabled: parseBooleanFlag(env[S3_CREATE_ENABLED_ENV], false),
    replaceEnabled: parseBooleanFlag(env[S3_REPLACE_ENABLED_ENV], false),
    hostWritesApproved: parseBooleanFlag(
      env[S3_HOST_WRITES_APPROVED_ENV],
      false,
    ),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "AWS S3 connector configuration is invalid.",
    );
  }

  return parsed.data;
}
