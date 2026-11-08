import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";
import { loadFreshdeskConfig } from "../src/config.js";

describe("loadFreshdeskConfig", () => {
  it("requires domain and api key", () => {
    expect(() => loadFreshdeskConfig({})).toThrow(ConnectorSdkError);
  });
  it("loads with test api base", () => {
    const config = loadFreshdeskConfig({
      OSVA_CONNECTOR_FRESHDESK_DOMAIN: "acme",
      OSVA_CONNECTOR_FRESHDESK_API_KEY: "key",
      OSVA_CONNECTOR_FRESHDESK_ALLOW_TEST_API_HOST: "true",
      OSVA_CONNECTOR_FRESHDESK_API_BASE_URL: "http://127.0.0.1:1/api/v2",
    });
    expect(config.apiKey).toBe("key");
    expect(config.notesEnabled).toBe(false);
  });
});
