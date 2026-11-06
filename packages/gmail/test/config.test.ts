import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  GMAIL_ACCESS_TOKEN_ENV,
  GMAIL_ALLOWED_RECIPIENTS_ENV,
  GMAIL_DRAFTS_ENABLED_ENV,
  GMAIL_HOST_SEND_APPROVED_ENV,
  GMAIL_SEND_ENABLED_ENV,
  GMAIL_USE_DOMAIN_DELEGATION_ENV,
} from "../src/constants.js";
import { loadGmailConfig } from "../src/config.js";

describe("loadGmailConfig", () => {
  it("rejects delegation with static token", () => {
    expect(() =>
      loadGmailConfig({
        [GMAIL_USE_DOMAIN_DELEGATION_ENV]: "true",
        OSVA_CONNECTOR_GMAIL_DELEGATED_USER_EMAIL: "u@example.com",
        [GMAIL_ACCESS_TOKEN_ENV]: "token",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("requires allowlist when send is enabled", () => {
    expect(() =>
      loadGmailConfig({
        [GMAIL_SEND_ENABLED_ENV]: "true",
        [GMAIL_HOST_SEND_APPROVED_ENV]: "true",
        [GMAIL_DRAFTS_ENABLED_ENV]: "true",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("accepts read-only defaults", () => {
    const c = loadGmailConfig({});
    expect(c.draftsEnabled).toBe(false);
    expect(c.sendEnabled).toBe(false);
  });

  it("accepts send flags with allowlist", () => {
    const c = loadGmailConfig({
      [GMAIL_SEND_ENABLED_ENV]: "true",
      [GMAIL_HOST_SEND_APPROVED_ENV]: "true",
      [GMAIL_DRAFTS_ENABLED_ENV]: "true",
      [GMAIL_ALLOWED_RECIPIENTS_ENV]: "a@example.com",
    });
    expect(c.sendEnabled).toBe(true);
  });
});
