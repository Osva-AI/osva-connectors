import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { z } from "zod";

import type { OutlookConfig } from "./schemas.js";

const bareAddrSpecSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .email()
  .refine((v) => !/[\0\r\n]/.test(v), "Invalid email.")
  .refine(
    (v) => !/[<>]/.test(v),
    "Display names and angle brackets are not allowed.",
  );

export function canonicalRecipientEmail(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Email address is empty.");
  }
  if (/[\0\r\n]/.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Email address contains invalid characters.",
    );
  }
  const parsed = parseSingleAddrSpec(trimmed);
  const lower = parsed.toLowerCase();
  const check = bareAddrSpecSchema.safeParse(lower);
  if (!check.success) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Invalid email address format.",
    );
  }
  return lower;
}

function parseSingleAddrSpec(input: string): string {
  if (input.includes(",")) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Multiple addresses in one field are not supported.",
    );
  }
  const angle = input.match(/^[^<]*<([^>]+)>$/);
  const core = (angle?.[1] ?? input).trim();
  if (core.includes("<") || core.includes(">")) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid address encoding.");
  }
  return core;
}

export function parseAllowlistEmailEntry(raw: string): string {
  return canonicalRecipientEmail(raw);
}

export function assertSendEnabledAndApproved(config: OutlookConfig): void {
  if (!config.sendEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Outlook sending is disabled. Set OSVA_CONNECTOR_OUTLOOK_SEND_ENABLED=true after host policy review.",
    );
  }
  if (!config.hostSendApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Outlook message send requires explicit host approval. Set OSVA_CONNECTOR_OUTLOOK_HOST_SEND_APPROVED=true only after workflow sign-off.",
    );
  }
}

export function assertWritesEnabledAndApproved(config: OutlookConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Outlook calendar writes are disabled. Set OSVA_CONNECTOR_OUTLOOK_WRITE_ENABLED=true after host policy review.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Outlook event create requires explicit host approval. Set OSVA_CONNECTOR_OUTLOOK_HOST_WRITES_APPROVED=true only after workflow sign-off.",
    );
  }
}

export function assertRecipientsAllowedByHostPolicy(
  recipients: readonly string[],
  config: OutlookConfig,
): void {
  const allowlist = config.allowedRecipients;
  if (allowlist === undefined || allowlist.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "No recipient allowlist is configured. Populate OSVA_CONNECTOR_OUTLOOK_ALLOWED_RECIPIENTS with host-approved addresses before sending.",
    );
  }
  const allowed = new Set(allowlist);
  for (const raw of recipients) {
    const email = canonicalRecipientEmail(raw);
    if (!allowed.has(email)) {
      throw new ConnectorSdkError(
        "FORBIDDEN",
        "Recipient is not on the host-configured allowlist.",
      );
    }
  }
}

function graphRecipients(addresses: readonly string[]): {
  emailAddress: { address: string };
}[] {
  return addresses.map((a) => ({
    emailAddress: { address: canonicalRecipientEmail(a) },
  }));
}

function sanitizeSubject(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed.length === 0) {
    return "(no subject)";
  }
  if (/[\r\n\x0B\x0C\u2028\u2029]/.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Subject contains invalid characters.",
    );
  }
  return trimmed;
}

const MAX_MESSAGE_BYTES = 512 * 1024;

export function buildGraphSendMailPayload(parts: {
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly bodyPlain: string;
}): { message: Record<string, unknown>; saveToSentItems: boolean } {
  const to = parts.to.map((e) => canonicalRecipientEmail(e));
  if (to.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "At least one To address is required.",
    );
  }
  const cc = parts.cc?.map((e) => canonicalRecipientEmail(e)) ?? [];
  const bcc = parts.bcc?.map((e) => canonicalRecipientEmail(e)) ?? [];

  const bodyBytes = Buffer.byteLength(parts.bodyPlain, "utf8");
  if (bodyBytes > MAX_MESSAGE_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Message body exceeds the connector size limit.",
    );
  }

  const message: Record<string, unknown> = {
    subject: sanitizeSubject(parts.subject),
    body: {
      contentType: "Text",
      content: parts.bodyPlain,
    },
    toRecipients: graphRecipients(to),
  };
  if (cc.length > 0) {
    message.ccRecipients = graphRecipients(cc);
  }
  if (bcc.length > 0) {
    message.bccRecipients = graphRecipients(bcc);
  }

  return { message, saveToSentItems: true };
}
