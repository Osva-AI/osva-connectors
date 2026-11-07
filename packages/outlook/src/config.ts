import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  OUTLOOK_ACCESS_TOKEN_ENV,
  OUTLOOK_ALLOWED_CALENDAR_IDS_ENV,
  OUTLOOK_ALLOWED_MAIL_FOLDER_IDS_ENV,
  OUTLOOK_ALLOWED_RECIPIENTS_ENV,
  OUTLOOK_HOST_SEND_APPROVED_ENV,
  OUTLOOK_HOST_WRITES_APPROVED_ENV,
  OUTLOOK_SEND_ENABLED_ENV,
  OUTLOOK_TIMEOUT_MS_ENV,
  OUTLOOK_WRITE_ENABLED_ENV,
} from "./constants.js";
import { parseGraphResourceId } from "./graph-id.js";
import { outlookConfigSchema, type OutlookConfig } from "./schemas.js";
import { parseAllowlistEmailEntry } from "./send-policy.js";

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

function parseTriStateIdList(
  raw: string | undefined,
  label: string,
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
  for (const p of parts) {
    const id = parseGraphResourceId(p, label);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parseAllowedRecipients(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parts = raw.split(",").map((part) => part.trim());
  const canonical: string[] = [];
  for (const p of parts) {
    if (p.length === 0) {
      continue;
    }
    canonical.push(parseAllowlistEmailEntry(p));
  }
  if (canonical.length === 0) {
    return undefined;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of canonical) {
    if (seen.has(email)) {
      continue;
    }
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function loadOutlookConfig(
  env: NodeJS.ProcessEnv = process.env,
): OutlookConfig {
  const rawAccess = env[OUTLOOK_ACCESS_TOKEN_ENV];
  const accessToken =
    rawAccess !== undefined && rawAccess.trim().length > 0
      ? rawAccess.trim()
      : undefined;

  if (accessToken === undefined) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "OSVA_CONNECTOR_OUTLOOK_ACCESS_TOKEN is required.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[OUTLOOK_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const allowedMailFolderIds = parseTriStateIdList(
    env[OUTLOOK_ALLOWED_MAIL_FOLDER_IDS_ENV],
    "mail folder ID",
  );
  const allowedCalendarIds = parseTriStateIdList(
    env[OUTLOOK_ALLOWED_CALENDAR_IDS_ENV],
    "calendar ID",
  );

  const sendEnabled = parseBooleanFlag(env[OUTLOOK_SEND_ENABLED_ENV], false);
  const hostSendApproved = parseBooleanFlag(
    env[OUTLOOK_HOST_SEND_APPROVED_ENV],
    false,
  );
  const writeEnabled = parseBooleanFlag(env[OUTLOOK_WRITE_ENABLED_ENV], false);
  const hostWritesApproved = parseBooleanFlag(
    env[OUTLOOK_HOST_WRITES_APPROVED_ENV],
    false,
  );
  const allowedRecipients = parseAllowedRecipients(
    env[OUTLOOK_ALLOWED_RECIPIENTS_ENV],
  );

  const parsed = outlookConfigSchema.safeParse({
    accessToken,
    requestTimeoutMs,
    allowedMailFolderIds,
    allowedCalendarIds,
    sendEnabled,
    hostSendApproved,
    allowedRecipients,
    writeEnabled,
    hostWritesApproved,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Outlook connector configuration is invalid.",
    );
  }

  if (
    parsed.data.sendEnabled === true &&
    (parsed.data.allowedRecipients === undefined ||
      parsed.data.allowedRecipients.length === 0)
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Send enablement requires OSVA_CONNECTOR_OUTLOOK_ALLOWED_RECIPIENTS.",
    );
  }

  return parsed.data;
}
