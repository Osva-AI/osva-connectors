import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";
import { loadSalesforceConfig } from "../src/config.js";

describe("loadSalesforceConfig", () => {
  it("requires instance URL and access token", () => {
    expect(() => loadSalesforceConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads with test instance host", () => {
    const config = loadSalesforceConfig({
      OSVA_CONNECTOR_SALESFORCE_INSTANCE_URL: "http://127.0.0.1:9",
      OSVA_CONNECTOR_SALESFORCE_ACCESS_TOKEN: "token",
      OSVA_CONNECTOR_SALESFORCE_ALLOW_TEST_API_HOST: "true",
      OSVA_CONNECTOR_SALESFORCE_API_VERSION: "v59.0",
    });
    expect(config.accessToken).toBe("token");
    expect(config.stageUpdatesEnabled).toBe(false);
    expect(config.tasksEnabled).toBe(false);
    expect(config.apiVersion).toBe("v59.0");
  });
});
