import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  SHEETS_ALLOWED_SPREADSHEETS_ENV,
  SHEETS_TIMEOUT_MS_ENV,
  SHEETS_WRITE_ENABLED_ENV,
  SPREADSHEET_ID_PATTERN,
  MAX_SPREADSHEET_ID_LENGTH,
} from "./constants.js";
import {
  googleSheetsConfigSchema,
  type GoogleSheetsConfig,
} from "./schemas.js";

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

function parseWriteEnabled(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim().length === 0) {
    return false;
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
    "Write enable flag must be true or false.",
  );
}

function parseAllowedSpreadsheetIds(
  raw: string | undefined,
): string[] | undefined {
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
      part.length > MAX_SPREADSHEET_ID_LENGTH ||
      !SPREADSHEET_ID_PATTERN.test(part)
    ) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowed spreadsheet list contains an invalid spreadsheetId.",
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

export function loadGoogleSheetsConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleSheetsConfig {
  const requestTimeoutMs = readBoundedInt(
    env[SHEETS_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const writeEnabled = parseWriteEnabled(env[SHEETS_WRITE_ENABLED_ENV]);
  const allowedSpreadsheetIds = parseAllowedSpreadsheetIds(
    env[SHEETS_ALLOWED_SPREADSHEETS_ENV],
  );

  const parsed = googleSheetsConfigSchema.safeParse({
    requestTimeoutMs,
    writeEnabled,
    allowedSpreadsheetIds,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Google Sheets connector configuration is invalid.",
    );
  }

  return parsed.data;
}
