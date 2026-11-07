import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadConfluenceConfig } from "../src/config.js";
import {
  CONFLUENCE_ACCESS_TOKEN_ENV,
  CONFLUENCE_ALLOWED_SPACE_IDS_ENV,
  CONFLUENCE_API_TOKEN_ENV,
  CONFLUENCE_CLOUD_ID_ENV,
  CONFLUENCE_EMAIL_ENV,
  CONFLUENCE_SITE_URL_ENV,
} from "../src/constants.js";

describe("loadConfluenceConfig", () => {
  it("requires credentials", () => {
    expect(() => loadConfluenceConfig({})).toThrow(ConnectorSdkError);
  });

  it("builds site bearer auth", () => {
    const config = loadConfluenceConfig({
      [CONFLUENCE_SITE_URL_ENV]: "https://example.atlassian.net",
      [CONFLUENCE_ACCESS_TOKEN_ENV]: "fixture_token",
    });
    expect(config.apiBaseV2).toBe("https://example.atlassian.net/wiki/api/v2");
    expect(config.authorizationHeader).toBe("Bearer fixture_token");
    expect(config.writeEnabled).toBe(false);
  });

  it("builds site basic auth", () => {
    const config = loadConfluenceConfig({
      [CONFLUENCE_SITE_URL_ENV]: "https://example.atlassian.net",
      [CONFLUENCE_EMAIL_ENV]: "user@example.com",
      [CONFLUENCE_API_TOKEN_ENV]: "api_token_fixture",
    });
    expect(config.authorizationHeader.startsWith("Basic ")).toBe(true);
    expect(config.credentialForRedaction).toBe("api_token_fixture");
  });

  it("builds gateway auth with cloud id", () => {
    const config = loadConfluenceConfig({
      [CONFLUENCE_CLOUD_ID_ENV]: "cloud-abc",
      [CONFLUENCE_ACCESS_TOKEN_ENV]: "oauth_fixture",
    });
    expect(config.apiBaseV2).toBe(
      "https://api.atlassian.com/ex/confluence/cloud-abc/wiki/api/v2",
    );
  });

  it("parses tri-state allowlist", () => {
    const unset = loadConfluenceConfig({
      [CONFLUENCE_SITE_URL_ENV]: "https://example.atlassian.net",
      [CONFLUENCE_ACCESS_TOKEN_ENV]: "t",
    });
    expect(unset.allowedSpaceIds).toBeUndefined();

    const denyAll = loadConfluenceConfig({
      [CONFLUENCE_SITE_URL_ENV]: "https://example.atlassian.net",
      [CONFLUENCE_ACCESS_TOKEN_ENV]: "t",
      [CONFLUENCE_ALLOWED_SPACE_IDS_ENV]: "",
    });
    expect(denyAll.allowedSpaceIds).toEqual([]);

    const restricted = loadConfluenceConfig({
      [CONFLUENCE_SITE_URL_ENV]: "https://example.atlassian.net",
      [CONFLUENCE_ACCESS_TOKEN_ENV]: "t",
      [CONFLUENCE_ALLOWED_SPACE_IDS_ENV]: "100,200",
    });
    expect(restricted.allowedSpaceIds).toEqual(["100", "200"]);
  });
});
