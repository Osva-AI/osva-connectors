import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_MAX_BLOCK_DEPTH,
  DEFAULT_NOTION_API_VERSION,
  DEFAULT_REQUEST_TIMEOUT_MS,
  NOTION_ACCESS_TOKEN_ENV,
  NOTION_API_VERSION_ENV,
  NOTION_HOST_WRITES_APPROVED_ENV,
  NOTION_MAX_BLOCK_DEPTH_ENV,
  NOTION_TIMEOUT_MS_ENV,
  NOTION_WRITE_ENABLED_ENV,
  SUPPORTED_NOTION_API_VERSIONS,
} from "./constants.js";
import { notionConfigSchema, type NotionConfig } from "./schemas.js";

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

function parseApiVersion(raw: string | undefined): string {
  if (raw === undefined || raw.trim().length === 0) {
    return DEFAULT_NOTION_API_VERSION;
  }
  const version = raw.trim();
  if (!(SUPPORTED_NOTION_API_VERSIONS as readonly string[]).includes(version)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Unsupported Notion API version.",
    );
  }
  return version;
}

export function loadNotionConfig(
  env: NodeJS.ProcessEnv = process.env,
): NotionConfig {
  const rawToken = env[NOTION_ACCESS_TOKEN_ENV];
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Notion integration token is required.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[NOTION_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const apiVersion = parseApiVersion(env[NOTION_API_VERSION_ENV]);
  const writeEnabled = parseBooleanFlag(env[NOTION_WRITE_ENABLED_ENV], false);
  const hostWritesApproved = parseBooleanFlag(
    env[NOTION_HOST_WRITES_APPROVED_ENV],
    false,
  );
  const maxBlockDepth = readBoundedInt(
    env[NOTION_MAX_BLOCK_DEPTH_ENV],
    DEFAULT_MAX_BLOCK_DEPTH,
    "Max block depth",
  );

  const parsed = notionConfigSchema.safeParse({
    accessToken: rawToken.trim(),
    requestTimeoutMs,
    apiVersion,
    writeEnabled,
    hostWritesApproved,
    maxBlockDepth,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Notion connector configuration is invalid.",
    );
  }

  return parsed.data;
}
