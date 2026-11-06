import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { canonicalRecipientEmail } from "./email-address.js";
import type { GmailConfig } from "./schemas.js";

export function assertDraftsEnabled(config: GmailConfig): void {
  if (!config.draftsEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Gmail draft tools are disabled. Set OSVA_CONNECTOR_GMAIL_DRAFTS_ENABLED=true after host policy review.",
    );
  }
}

export function assertSendEnabledAndApproved(config: GmailConfig): void {
  if (!config.sendEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Gmail sending is disabled. Set OSVA_CONNECTOR_GMAIL_SEND_ENABLED=true after host policy review.",
    );
  }
  if (!config.hostSendApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Gmail message send requires explicit host approval. Set OSVA_CONNECTOR_GMAIL_HOST_SEND_APPROVED=true only after workflow sign-off.",
    );
  }
}

export function assertRecipientsAllowedByHostPolicy(
  recipients: readonly string[],
  config: GmailConfig,
): void {
  const allowlist = config.allowedRecipients;
  if (allowlist === undefined || allowlist.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "No recipient allowlist is configured. Populate OSVA_CONNECTOR_GMAIL_ALLOWED_RECIPIENTS with host-approved addresses before drafts or sends.",
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

const MAX_RFC5322_BYTES = 256 * 1024;

/**
 * Build a minimal UTF-8 RFC 5322 message and return Gmail `raw` (base64url).
 */
export function buildGmailRawFromParts(parts: {
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly bodyPlain: string;
}): { raw: string } {
  const to = parts.to.map((e) => canonicalRecipientEmail(e));
  if (to.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "At least one To address is required.",
    );
  }
  const cc = parts.cc?.map((e) => canonicalRecipientEmail(e)) ?? [];
  const bcc = parts.bcc?.map((e) => canonicalRecipientEmail(e)) ?? [];

  const headers: string[] = [];
  headers.push(`To: ${to.join(", ")}`);
  if (cc.length > 0) {
    headers.push(`Cc: ${cc.join(", ")}`);
  }
  if (bcc.length > 0) {
    headers.push(`Bcc: ${bcc.join(", ")}`);
  }
  headers.push(`Subject: ${sanitizeSubject(parts.subject)}`);
  headers.push("MIME-Version: 1.0");
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push("Content-Transfer-Encoding: base64");
  const bodyB64 = foldBase64(
    Buffer.from(parts.bodyPlain, "utf8").toString("base64"),
  );
  const rfc = `${headers.join("\r\n")}\r\n\r\n${bodyB64}`;
  const bytes = Buffer.byteLength(rfc, "utf8");
  if (bytes > MAX_RFC5322_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Composed message exceeds the connector size limit.",
    );
  }
  return { raw: Buffer.from(rfc, "utf8").toString("base64url") };
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

function foldBase64(b64: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += 76) {
    chunks.push(b64.slice(i, i + 76));
  }
  return chunks.join("\r\n");
}
