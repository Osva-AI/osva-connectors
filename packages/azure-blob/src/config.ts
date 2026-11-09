import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  AZURE_BLOB_ACCOUNT_NAME_ENV,
  AZURE_BLOB_ACCOUNT_WIDE_CONTAINER_DISCOVERY_ENV,
  AZURE_BLOB_ALLOWED_CONTAINERS_READ_ENV,
  AZURE_BLOB_ALLOWED_CONTAINERS_WRITE_ENV,
  AZURE_BLOB_CREATE_ENABLED_ENV,
  AZURE_BLOB_HOST_WRITES_APPROVED_ENV,
  AZURE_BLOB_REPLACE_ENABLED_ENV,
  AZURE_BLOB_TIMEOUT_MS_ENV,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./constants.js";
import { parseContainerScopeMap } from "./resource-scope.js";
import { azureBlobConfigSchema, type AzureBlobConfig } from "./schemas.js";

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

export function loadAzureBlobConfig(
  env: NodeJS.ProcessEnv = process.env,
): AzureBlobConfig {
  const accountName = env[AZURE_BLOB_ACCOUNT_NAME_ENV]?.trim();
  if (accountName === undefined || accountName.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Azure storage account name is required (OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_NAME).",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[AZURE_BLOB_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = azureBlobConfigSchema.safeParse({
    accountName,
    requestTimeoutMs,
    allowedContainersRead: parseContainerScopeMap(
      env[AZURE_BLOB_ALLOWED_CONTAINERS_READ_ENV],
      "OSVA_CONNECTOR_AZURE_BLOB_ALLOWED_CONTAINERS_READ",
    ),
    allowedContainersWrite: parseContainerScopeMap(
      env[AZURE_BLOB_ALLOWED_CONTAINERS_WRITE_ENV],
      "OSVA_CONNECTOR_AZURE_BLOB_ALLOWED_CONTAINERS_WRITE",
    ),
    accountWideContainerDiscovery: parseBooleanFlag(
      env[AZURE_BLOB_ACCOUNT_WIDE_CONTAINER_DISCOVERY_ENV],
      false,
    ),
    createEnabled: parseBooleanFlag(env[AZURE_BLOB_CREATE_ENABLED_ENV], false),
    replaceEnabled: parseBooleanFlag(
      env[AZURE_BLOB_REPLACE_ENABLED_ENV],
      false,
    ),
    hostWritesApproved: parseBooleanFlag(
      env[AZURE_BLOB_HOST_WRITES_APPROVED_ENV],
      false,
    ),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Azure Blob connector configuration is invalid.",
    );
  }

  return parsed.data;
}
