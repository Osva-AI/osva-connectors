import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_PHONE_NUMBER_ID_LENGTH,
  MAX_TEMPLATE_ID_LENGTH,
  MAX_WABA_ID_LENGTH,
} from "./constants.js";

const NUMERIC_ID_PATTERN = /^\d+$/;

export function normalizeWabaIdInput(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_WABA_ID_LENGTH ||
    !NUMERIC_ID_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "WhatsApp Business Account ID is not valid.",
    );
  }
  return trimmed;
}

export function normalizePhoneNumberIdInput(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_PHONE_NUMBER_ID_LENGTH ||
    !NUMERIC_ID_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Phone number ID is not valid.",
    );
  }
  return trimmed;
}

export function normalizeTemplateIdInput(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_TEMPLATE_ID_LENGTH ||
    !NUMERIC_ID_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", "Template ID is not valid.");
  }
  return trimmed;
}

/** E.164 digits only (no leading + in stored form). */
export function normalizeRecipientE164(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.startsWith("+")
    ? trimmed.slice(1).replace(/\D/g, "")
    : trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Recipient phone number is not valid E.164.",
    );
  }
  return digits;
}
