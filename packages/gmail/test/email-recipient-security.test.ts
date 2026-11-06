import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  canonicalRecipientEmail,
  parseAllowlistEmailEntry,
} from "../src/email-address.js";
import {
  assertRecipientsAllowedByHostPolicy,
  buildGmailRawFromParts,
} from "../src/send-policy.js";
import { composedMessageSchema } from "../src/tool-schemas.js";
import type { GmailConfig } from "../src/schemas.js";

describe("Gmail recipient allowlist and address canonicalization", () => {
  const allowlistConfig: GmailConfig = {
    requestTimeoutMs: 5_000,
    useDomainDelegation: false,
    draftsEnabled: true,
    sendEnabled: true,
    hostSendApproved: true,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    allowedRecipients: ["allowed@example.com"],
  };

  it("normalizes bare and angle-bracket forms consistently for allowlist parsing", () => {
    expect(parseAllowlistEmailEntry("Allowed@Example.COM")).toBe(
      "allowed@example.com",
    );
    expect(parseAllowlistEmailEntry('"X" <allowed@example.com>')).toBe(
      "allowed@example.com",
    );
  });

  it("rejects malformed or injection-prone address forms", () => {
    for (const bad of [
      "",
      "a@b.com\r\nBcc: evil@example.com",
      "group: a@b.com;",
      "a@b.com, c@d.com",
      "not-an-email",
    ]) {
      expect(() => canonicalRecipientEmail(bad)).toThrow(ConnectorSdkError);
    }
  });

  it("rejects allowlist bypass via display-name tricks on cc", () => {
    expect(() =>
      assertRecipientsAllowedByHostPolicy(
        [parseAllowlistEmailEntry('"Victim" <forbidden@victim.com>')],
        allowlistConfig,
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("composedMessageSchema canonicalizes tool-supplied recipients", () => {
    const parsed = composedMessageSchema.parse({
      to: ['"Name" <allowed@example.com>'],
      cc: ["Allowed@Example.COM"],
      subject: "s",
      bodyPlain: "b",
    });
    expect(parsed.to).toEqual(["allowed@example.com"]);
    expect(parsed.cc).toEqual(["allowed@example.com"]);
  });

  it("buildGmailRawFromParts emits only canonical addresses in To/Cc/Bcc lines", () => {
    const { raw } = buildGmailRawFromParts({
      to: ["allowed@example.com", "Allowed@Example.COM"],
      cc: ['"X" <allowed@example.com>'],
      subject: "Hello",
      bodyPlain: "Body",
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("To: allowed@example.com, allowed@example.com");
    expect(decoded).toContain("Cc: allowed@example.com");
    expect(decoded).not.toMatch(/[<>]/);
  });

  it("rejects subject lines with vertical tab or line/paragraph separators", () => {
    expect(() =>
      buildGmailRawFromParts({
        to: ["allowed@example.com"],
        subject: "bad\u000bsubject",
        bodyPlain: "x",
      }),
    ).toThrow(ConnectorSdkError);
    expect(() =>
      buildGmailRawFromParts({
        to: ["allowed@example.com"],
        subject: "bad\u2028subject",
        bodyPlain: "x",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
