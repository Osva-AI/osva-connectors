import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadJiraConfig } from "../src/config.js";
import {
  JIRA_ACCESS_TOKEN_ENV,
  JIRA_ALLOWED_PROJECT_KEYS_ENV,
  JIRA_API_TOKEN_ENV,
  JIRA_CLOUD_ID_ENV,
  JIRA_EMAIL_ENV,
  JIRA_SITE_URL_ENV,
} from "../src/constants.js";

const SITE = "https://example.atlassian.net";

describe("loadJiraConfig", () => {
  it("requires site URL or cloud ID", () => {
    expect(() => loadJiraConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads basic auth from site URL, email, and API token", () => {
    const config = loadJiraConfig({
      [JIRA_SITE_URL_ENV]: SITE,
      [JIRA_EMAIL_ENV]: "user@example.com",
      [JIRA_API_TOKEN_ENV]: "token",
    });
    expect(config.authorizationHeader.startsWith("Basic ")).toBe(true);
    expect(config.apiBasePath).toBe(`${SITE}/rest/api/3`);
  });

  it("loads bearer auth from site URL and access token", () => {
    const config = loadJiraConfig({
      [JIRA_SITE_URL_ENV]: SITE,
      [JIRA_ACCESS_TOKEN_ENV]: "oauth-token",
    });
    expect(config.authorizationHeader).toBe("Bearer oauth-token");
  });

  it("loads cloud ID bearer auth against Atlassian API host", () => {
    const config = loadJiraConfig({
      [JIRA_CLOUD_ID_ENV]: "cloud-uuid",
      [JIRA_ACCESS_TOKEN_ENV]: "oauth-token",
    });
    expect(config.apiBasePath).toContain("/ex/jira/cloud-uuid/rest/api/3");
    expect(config.authorizationHeader).toBe("Bearer oauth-token");
  });

  it("tri-state allowlist: undefined unrestricted", () => {
    const config = loadJiraConfig({
      [JIRA_SITE_URL_ENV]: SITE,
      [JIRA_ACCESS_TOKEN_ENV]: "t",
    });
    expect(config.allowedProjectKeys).toBeUndefined();
  });

  it("tri-state allowlist: empty string deny all", () => {
    const config = loadJiraConfig({
      [JIRA_SITE_URL_ENV]: SITE,
      [JIRA_ACCESS_TOKEN_ENV]: "t",
      [JIRA_ALLOWED_PROJECT_KEYS_ENV]: "",
    });
    expect(config.allowedProjectKeys).toEqual([]);
  });

  it("defaults to read-only mutation flags", () => {
    const config = loadJiraConfig({
      [JIRA_SITE_URL_ENV]: SITE,
      [JIRA_ACCESS_TOKEN_ENV]: "t",
    });
    expect(config.writeEnabled).toBe(false);
    expect(config.hostWritesApproved).toBe(false);
  });
});
