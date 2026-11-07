import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadOutlookConfig } from "../src/config.js";
import {
  OUTLOOK_ACCESS_TOKEN_ENV,
  OUTLOOK_ALLOWED_MAIL_FOLDER_IDS_ENV,
  OUTLOOK_ALLOWED_RECIPIENTS_ENV,
  OUTLOOK_HOST_SEND_APPROVED_ENV,
  OUTLOOK_SEND_ENABLED_ENV,
} from "../src/constants.js";

describe("loadOutlookConfig", () => {
  it("requires access token", () => {
    expect(() => loadOutlookConfig({})).toThrow(ConnectorSdkError);
  });

  it("accepts read-only defaults with token", () => {
    const c = loadOutlookConfig({
      [OUTLOOK_ACCESS_TOKEN_ENV]: "delegated-token",
    });
    expect(c.sendEnabled).toBe(false);
    expect(c.writeEnabled).toBe(false);
    expect(c.allowedMailFolderIds).toBeUndefined();
  });

  it("requires allowlist when send is enabled", () => {
    expect(() =>
      loadOutlookConfig({
        [OUTLOOK_ACCESS_TOKEN_ENV]: "t",
        [OUTLOOK_SEND_ENABLED_ENV]: "true",
        [OUTLOOK_HOST_SEND_APPROVED_ENV]: "true",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("accepts send flags with allowlist", () => {
    const c = loadOutlookConfig({
      [OUTLOOK_ACCESS_TOKEN_ENV]: "t",
      [OUTLOOK_SEND_ENABLED_ENV]: "true",
      [OUTLOOK_HOST_SEND_APPROVED_ENV]: "true",
      [OUTLOOK_ALLOWED_RECIPIENTS_ENV]: "a@example.com",
    });
    expect(c.sendEnabled).toBe(true);
    expect(c.allowedRecipients).toEqual(["a@example.com"]);
  });

  it("tri-state mail folder allowlist: empty string deny all", () => {
    const c = loadOutlookConfig({
      [OUTLOOK_ACCESS_TOKEN_ENV]: "t",
      [OUTLOOK_ALLOWED_MAIL_FOLDER_IDS_ENV]: "",
    });
    expect(c.allowedMailFolderIds).toEqual([]);
  });
});
