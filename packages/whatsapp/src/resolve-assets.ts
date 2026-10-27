import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { WhatsAppConfig } from "./schemas.js";
import {
  normalizePhoneNumberIdInput,
  normalizeWabaIdInput,
} from "./resource-id.js";

export function resolveWabaId(
  inputWabaId: string | undefined,
  config: WhatsAppConfig,
): string {
  const wabaId =
    inputWabaId !== undefined
      ? normalizeWabaIdInput(inputWabaId)
      : config.wabaId;
  if (wabaId !== config.wabaId) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "WhatsApp Business Account ID is not allowed for this connector instance.",
    );
  }
  return wabaId;
}

export function resolvePhoneNumberId(
  inputPhoneNumberId: string | undefined,
  config: WhatsAppConfig,
): string {
  const phoneNumberId =
    inputPhoneNumberId !== undefined
      ? normalizePhoneNumberIdInput(inputPhoneNumberId)
      : config.phoneNumberId;
  if (phoneNumberId !== config.phoneNumberId) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Phone number ID is not allowed for this connector instance.",
    );
  }
  if (config.allowedPhoneNumberIds !== undefined) {
    if (!config.allowedPhoneNumberIds.includes(phoneNumberId)) {
      throw new ConnectorSdkError(
        "FORBIDDEN",
        "Phone number ID is not in the configured allowlist.",
      );
    }
  }
  return phoneNumberId;
}

export function filterAllowedPhoneNumberIds(
  phoneNumberId: string,
  allowed?: readonly string[],
): boolean {
  if (allowed === undefined) {
    return true;
  }
  return allowed.includes(phoneNumberId);
}
