import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadZendeskConfig } from "../src/config.js";
import {
  ZENDESK_ALLOW_TEST_API_HOST_ENV,
  ZENDESK_API_BASE_URL_ENV,
  ZENDESK_API_TOKEN_ENV,
  ZENDESK_EMAIL_ENV,
  ZENDESK_NOTES_ENABLED_ENV,
  ZENDESK_SUBDOMAIN_ENV,
} from "../src/constants.js";

describe("loadZendeskConfig", () => {
  it("requires subdomain, email, and token", () => {
    expect(() => loadZendeskConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads test API base when allowed", () => {
    const config = loadZendeskConfig({
      [ZENDESK_SUBDOMAIN_ENV]: "fixture",
      [ZENDESK_EMAIL_ENV]: "agent@example.test",
      [ZENDESK_API_TOKEN_ENV]: "token",
      [ZENDESK_ALLOW_TEST_API_HOST_ENV]: "true",
      [ZENDESK_API_BASE_URL_ENV]: "http://127.0.0.1:9/api/v2",
    });
    expect(config.apiBaseUrl).toBe("http://127.0.0.1:9/api/v2");
    expect(config.notesEnabled).toBe(false);
  });

  it("tri-state ticket allowlist: empty string deny all", () => {
    const config = loadZendeskConfig({
      [ZENDESK_SUBDOMAIN_ENV]: "fixture",
      [ZENDESK_EMAIL_ENV]: "a@b.test",
      [ZENDESK_API_TOKEN_ENV]: "t",
      OSVA_CONNECTOR_ZENDESK_ALLOWED_TICKET_IDS: "",
    });
    expect(config.allowedResourceIds).toEqual([]);
  });

  it("defaults mutations disabled", () => {
    const config = loadZendeskConfig({
      [ZENDESK_SUBDOMAIN_ENV]: "fixture",
      [ZENDESK_EMAIL_ENV]: "a@b.test",
      [ZENDESK_API_TOKEN_ENV]: "t",
      [ZENDESK_NOTES_ENABLED_ENV]: "false",
    });
    expect(config.hostWritesApproved).toBe(false);
  });
});
