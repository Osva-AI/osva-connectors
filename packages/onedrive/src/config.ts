import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_MAX_CONTENT_BYTES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SMALL_UPLOAD_MAX_BYTES,
  ONEDRIVE_ACCESS_TOKEN_ENV,
  ONEDRIVE_ALLOWED_DRIVE_IDS_ENV,
  ONEDRIVE_ALLOWED_ROOT_ITEM_IDS_ENV,
  ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS_ENV,
  ONEDRIVE_HOST_WRITES_APPROVED_ENV,
  ONEDRIVE_MAX_CONTENT_BYTES_ENV,
  ONEDRIVE_TIMEOUT_MS_ENV,
  ONEDRIVE_WRITE_ENABLED_ENV,
} from "./constants.js";
import { parseDriveId, parseItemId } from "./onedrive-ids.js";
import { onedriveConfigSchema, type OneDriveConfig } from "./schemas.js";

const DRIVE_ID_PATTERN = /^[a-zA-Z0-9!._-]+$/;

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

/** `undefined` — absent; no allowlist. `[]` — present but empty: deny-all. */
function parseTriStateIds(
  raw: string | undefined,
  parseOne: (part: string) => string,
): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const id = parseOne(part);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parseAllowedDriveIds(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  return parseTriStateIds(raw, (part) => {
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
    return parseDriveId(part, "drive id");
  });
}

function parseAllowedRootItemIds(
  raw: string | undefined,
): string[] | undefined {
  return parseTriStateIds(raw, (part) => parseItemId(part, "root item id"));
}

function parseAllowedUploadFolderIds(
  raw: string | undefined,
  writeEnabled: boolean,
): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    if (writeEnabled) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "OSVA_CONNECTOR_ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS must be non-empty when set and writes are enabled.",
      );
    }
    return [];
  }
  const ids = parseTriStateIds(raw, (part) =>
    parseItemId(part, "upload folder id"),
  );
  if (writeEnabled && ids !== undefined && ids.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "OSVA_CONNECTOR_ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS must be non-empty when set and writes are enabled.",
    );
  }
  return ids;
}

export function loadOneDriveConfig(
  env: NodeJS.ProcessEnv = process.env,
): OneDriveConfig {
  const accessToken = env[ONEDRIVE_ACCESS_TOKEN_ENV]?.trim();
  if (accessToken === undefined || accessToken.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "OSVA_CONNECTOR_ONEDRIVE_ACCESS_TOKEN is required.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[ONEDRIVE_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const maxContentBytes = readBoundedInt(
    env[ONEDRIVE_MAX_CONTENT_BYTES_ENV],
    DEFAULT_MAX_CONTENT_BYTES,
    "Max content bytes",
  );
  const writeEnabled = parseBooleanFlag(env[ONEDRIVE_WRITE_ENABLED_ENV], false);
  const hostWritesApproved = parseBooleanFlag(
    env[ONEDRIVE_HOST_WRITES_APPROVED_ENV],
    false,
  );
  const allowedDriveIds = parseAllowedDriveIds(
    env[ONEDRIVE_ALLOWED_DRIVE_IDS_ENV],
  );
  const allowedRootItemIds = parseAllowedRootItemIds(
    env[ONEDRIVE_ALLOWED_ROOT_ITEM_IDS_ENV],
  );
  const allowedUploadFolderIds = parseAllowedUploadFolderIds(
    env[ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS_ENV],
    writeEnabled,
  );

  const smallUploadMaxBytes = Math.min(
    maxContentBytes,
    DEFAULT_SMALL_UPLOAD_MAX_BYTES,
  );

  const parsed = onedriveConfigSchema.safeParse({
    accessToken,
    requestTimeoutMs,
    maxContentBytes,
    smallUploadMaxBytes,
    writeEnabled,
    hostWritesApproved,
    allowedDriveIds,
    allowedRootItemIds,
    allowedUploadFolderIds,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "OneDrive connector configuration is invalid.",
    );
  }

  return parsed.data;
}
