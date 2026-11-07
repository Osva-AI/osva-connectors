import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  QDRANT_ALLOW_LOCAL_HTTP_ENV,
  QDRANT_ALLOWED_COLLECTIONS_ENV,
  QDRANT_API_KEY_ENV,
  QDRANT_HOST_WRITES_APPROVED_ENV,
  QDRANT_TIMEOUT_MS_ENV,
  QDRANT_URL_ENV,
  QDRANT_WRITE_ENABLED_ENV,
} from "./constants.js";
import { parseQdrantBaseUrl } from "./qdrant-base-url.js";
import { qdrantConfigSchema, type QdrantConfig } from "./schemas.js";

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

function parseAllowedCollections(
  raw: string | undefined,
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
  for (const name of parts) {
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function loadQdrantConfig(
  env: NodeJS.ProcessEnv = process.env,
): QdrantConfig {
  const rawUrl = env[QDRANT_URL_ENV];
  if (rawUrl === undefined || rawUrl.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Qdrant URL is required.",
    );
  }

  const allowLocalHttp = parseBooleanFlag(
    env[QDRANT_ALLOW_LOCAL_HTTP_ENV],
    false,
  );
  const baseUrl = parseQdrantBaseUrl(rawUrl, allowLocalHttp);

  const rawKey = env[QDRANT_API_KEY_ENV]?.trim();
  const apiKey = rawKey !== undefined && rawKey.length > 0 ? rawKey : undefined;

  const requestTimeoutMs = readBoundedInt(
    env[QDRANT_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const writeEnabled = parseBooleanFlag(env[QDRANT_WRITE_ENABLED_ENV], false);
  const hostWritesApproved = parseBooleanFlag(
    env[QDRANT_HOST_WRITES_APPROVED_ENV],
    false,
  );
  const allowedCollections = parseAllowedCollections(
    env[QDRANT_ALLOWED_COLLECTIONS_ENV],
  );

  const parsed = qdrantConfigSchema.safeParse({
    baseUrl,
    ...(apiKey !== undefined ? { apiKey } : {}),
    allowLocalHttp,
    ...(allowedCollections !== undefined ? { allowedCollections } : {}),
    writeEnabled,
    hostWritesApproved,
    requestTimeoutMs,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Qdrant connector configuration is invalid.",
    );
  }

  return parsed.data;
}
