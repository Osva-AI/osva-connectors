import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  PINECONE_ALLOWED_INDEXES_ENV,
  PINECONE_ALLOWED_NAMESPACES_ENV,
  PINECONE_API_KEY_ENV,
  PINECONE_HOST_WRITES_APPROVED_ENV,
  PINECONE_TIMEOUT_MS_ENV,
  PINECONE_WRITE_ENABLED_ENV,
} from "./constants.js";
import { pineconeConfigSchema, type PineconeConfig } from "./schemas.js";

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

function parseCsvAllowlist(raw: string | undefined): string[] | undefined {
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
  for (const value of parts) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function loadPineconeConfig(
  env: NodeJS.ProcessEnv = process.env,
): PineconeConfig {
  const rawKey = env[PINECONE_API_KEY_ENV];
  if (rawKey === undefined || rawKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Pinecone API key is required.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[PINECONE_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const writeEnabled = parseBooleanFlag(env[PINECONE_WRITE_ENABLED_ENV], false);
  const hostWritesApproved = parseBooleanFlag(
    env[PINECONE_HOST_WRITES_APPROVED_ENV],
    false,
  );
  const allowedIndexes = parseCsvAllowlist(env[PINECONE_ALLOWED_INDEXES_ENV]);
  const allowedNamespaces = parseCsvAllowlist(
    env[PINECONE_ALLOWED_NAMESPACES_ENV],
  );

  const parsed = pineconeConfigSchema.safeParse({
    apiKey: rawKey.trim(),
    requestTimeoutMs,
    writeEnabled,
    hostWritesApproved,
    ...(allowedIndexes !== undefined ? { allowedIndexes } : {}),
    ...(allowedNamespaces !== undefined ? { allowedNamespaces } : {}),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Pinecone connector configuration is invalid.",
    );
  }

  return parsed.data;
}
