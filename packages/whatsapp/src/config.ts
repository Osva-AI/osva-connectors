import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_MAX_ROWS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  WHATSAPP_ACCESS_TOKEN_ENV,
  WHATSAPP_ALLOWED_PHONE_NUMBERS_ENV,
  WHATSAPP_ALLOWED_RECIPIENTS_ENV,
  WHATSAPP_APP_SECRET_ENV,
  WHATSAPP_MAX_ROWS_ENV,
  WHATSAPP_PHONE_NUMBER_ID_ENV,
  WHATSAPP_SEND_ENABLED_ENV,
  WHATSAPP_TIMEOUT_MS_ENV,
  WHATSAPP_WABA_ID_ENV,
} from "./constants.js";
import {
  normalizePhoneNumberIdInput,
  normalizeRecipientE164,
  normalizeWabaIdInput,
} from "./resource-id.js";
import { whatsappConfigSchema, type WhatsAppConfig } from "./schemas.js";

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

function parseSendEnabled(raw: string | undefined): boolean {
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
    "Send enable flag must be true or false.",
  );
}

function parseCommaList(raw: string | undefined): string[] | undefined {
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
  return parts;
}

function parseAllowedPhoneNumberIds(
  raw: string | undefined,
): string[] | undefined {
  const parts = parseCommaList(raw);
  if (parts === undefined) {
    return undefined;
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const normalized = normalizePhoneNumberIdInput(part);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

function parseAllowedRecipients(raw: string | undefined): string[] | undefined {
  const parts = parseCommaList(raw);
  if (parts === undefined) {
    return undefined;
  }
  const recipients: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    let normalized: string;
    try {
      normalized = normalizeRecipientE164(part);
    } catch {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowed recipient list contains an invalid E.164 number.",
      );
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    recipients.push(normalized);
  }
  return recipients;
}

export function loadWhatsAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppConfig {
  const rawToken = env[WHATSAPP_ACCESS_TOKEN_ENV];
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WhatsApp access token is not configured.",
    );
  }

  const rawWaba = env[WHATSAPP_WABA_ID_ENV];
  if (rawWaba === undefined || rawWaba.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WhatsApp Business Account ID is not configured.",
    );
  }

  const rawPhone = env[WHATSAPP_PHONE_NUMBER_ID_ENV];
  if (rawPhone === undefined || rawPhone.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WhatsApp phone number ID is not configured.",
    );
  }

  const appSecretRaw = env[WHATSAPP_APP_SECRET_ENV];
  const appSecret =
    appSecretRaw !== undefined && appSecretRaw.trim().length > 0
      ? appSecretRaw.trim()
      : undefined;

  const sendEnabled = parseSendEnabled(env[WHATSAPP_SEND_ENABLED_ENV]);
  const allowedPhoneNumberIds = parseAllowedPhoneNumberIds(
    env[WHATSAPP_ALLOWED_PHONE_NUMBERS_ENV],
  );
  const allowedRecipients = parseAllowedRecipients(
    env[WHATSAPP_ALLOWED_RECIPIENTS_ENV],
  );

  const requestTimeoutMs = readBoundedInt(
    env[WHATSAPP_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const maxRows = readBoundedInt(
    env[WHATSAPP_MAX_ROWS_ENV],
    DEFAULT_MAX_ROWS,
    "Max rows",
  );

  let wabaId: string;
  let phoneNumberId: string;
  try {
    wabaId = normalizeWabaIdInput(rawWaba);
    phoneNumberId = normalizePhoneNumberIdInput(rawPhone);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WhatsApp connector asset IDs are invalid.",
    );
  }

  if (
    allowedPhoneNumberIds !== undefined &&
    !allowedPhoneNumberIds.includes(phoneNumberId)
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Configured phone number ID must appear in OSVA_CONNECTOR_WHATSAPP_ALLOWED_PHONE_NUMBERS when that allowlist is set.",
    );
  }

  const parsed = whatsappConfigSchema.safeParse({
    accessToken: rawToken.trim(),
    wabaId,
    phoneNumberId,
    appSecret,
    allowedPhoneNumberIds,
    allowedRecipients,
    sendEnabled,
    requestTimeoutMs,
    maxRows,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WhatsApp connector configuration is invalid.",
    );
  }

  return parsed.data;
}
