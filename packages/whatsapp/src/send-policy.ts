import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { WhatsAppConfig } from "./schemas.js";
import { normalizeRecipientE164 } from "./resource-id.js";

export function assertTemplateSendEnabled(config: WhatsAppConfig): void {
  if (!config.sendEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "WhatsApp template sends are disabled. Set OSVA_CONNECTOR_WHATSAPP_SEND_ENABLED=true after host policy review.",
    );
  }
}

/**
 * Recipient opt-in is enforced via host-configured allowlist only (not tool arguments).
 * The MCP host must populate OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS with numbers
 * that have verifiable WhatsApp marketing/utility opt-in on the host side.
 */
export function assertRecipientAllowedByHostPolicy(
  recipientInput: string,
  config: WhatsAppConfig,
): string {
  const recipient = normalizeRecipientE164(recipientInput);
  const allowlist = config.allowedRecipients;
  if (allowlist === undefined || allowlist.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "No recipient opt-in allowlist is configured. Populate OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS with host-verified opt-in numbers before enabling sends.",
    );
  }
  if (!allowlist.includes(recipient)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Recipient is not on the host-configured opt-in allowlist.",
    );
  }
  return recipient;
}

const BLOCKED_TEMPLATE_CATEGORIES = new Set(["AUTHENTICATION"]);

export function assertTemplateEligibleForSend(template: {
  readonly status: string | null;
  readonly category: string | null;
  readonly language: string | null;
}): void {
  const status = template.status?.toUpperCase() ?? "";
  if (status !== "APPROVED") {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Only approved templates can be sent.",
    );
  }
  const category = template.category?.toUpperCase() ?? "";
  if (BLOCKED_TEMPLATE_CATEGORIES.has(category)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Authentication (OTP) templates cannot be sent through this connector in v0.1.0.",
    );
  }
  if (template.language === null || template.language.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Template language is missing from provider metadata.",
    );
  }
}

export function countBodyPlaceholders(components: unknown): number {
  if (!Array.isArray(components)) {
    return 0;
  }
  for (const component of components) {
    if (component === null || typeof component !== "object") {
      continue;
    }
    const record = component as { type?: unknown; text?: unknown };
    if (record.type === "BODY" && typeof record.text === "string") {
      const matches = record.text.match(/\{\{\d+\}\}/g);
      return matches?.length ?? 0;
    }
  }
  return 0;
}
