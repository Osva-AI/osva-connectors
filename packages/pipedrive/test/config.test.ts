import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";
import { loadPipedriveConfig } from "../src/config.js";

describe("loadPipedriveConfig", () => {
  it("requires company domain and api token", () => {
    expect(() => loadPipedriveConfig({})).toThrow(ConnectorSdkError);
  });
  it("loads with test api base", () => {
    const config = loadPipedriveConfig({
      OSVA_CONNECTOR_PIPEDRIVE_COMPANY_DOMAIN: "acme",
      OSVA_CONNECTOR_PIPEDRIVE_API_TOKEN: "token",
      OSVA_CONNECTOR_PIPEDRIVE_ALLOW_TEST_API_HOST: "true",
      OSVA_CONNECTOR_PIPEDRIVE_API_BASE_URL: "http://127.0.0.1:1/api/v2",
    });
    expect(config.apiToken).toBe("token");
    expect(config.stageUpdatesEnabled).toBe(false);
  });
});
