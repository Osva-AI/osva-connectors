import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_MAX_CONTENT_BYTES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DRIVE_ALLOWED_DRIVE_IDS_ENV,
  DRIVE_MAX_CONTENT_BYTES_ENV,
  DRIVE_TIMEOUT_MS_ENV,
} from "./constants.js";
import { googleDriveConfigSchema, type GoogleDriveConfig } from "./schemas.js";

const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

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

function parseAllowedDriveIds(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (
      part.length === 0 ||
      part.length > 128 ||
      !DRIVE_ID_PATTERN.test(part)
    ) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowed drive ID list contains an invalid driveId.",
      );
    }
    if (seen.has(part)) {
      continue;
    }
    seen.add(part);
    ids.push(part);
  }
  return ids;
}

export function loadGoogleDriveConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleDriveConfig {
  const requestTimeoutMs = readBoundedInt(
    env[DRIVE_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const maxContentBytes = readBoundedInt(
    env[DRIVE_MAX_CONTENT_BYTES_ENV],
    DEFAULT_MAX_CONTENT_BYTES,
    "Max content bytes",
  );
  const allowedDriveIds = parseAllowedDriveIds(
    env[DRIVE_ALLOWED_DRIVE_IDS_ENV],
  );

  const parsed = googleDriveConfigSchema.safeParse({
    requestTimeoutMs,
    maxContentBytes,
    allowedDriveIds,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Google Drive connector configuration is invalid.",
    );
  }

  return parsed.data;
}
