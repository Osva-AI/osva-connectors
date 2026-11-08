import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";
import { loadZohoConfig } from "../src/config.js";

describe("loadZohoConfig", () => {
  it("requires token and region", () => {
    expect(() => loadZohoConfig({})).toThrow(ConnectorSdkError);
  });
  it("loads with test api base", () => {
    const config = loadZohoConfig({
      OSVA_CONNECTOR_ZOHO_CRM_ACCESS_TOKEN: "token",
      OSVA_CONNECTOR_ZOHO_CRM_REGION: "us",
      OSVA_CONNECTOR_ZOHO_CRM_ALLOW_TEST_API_HOST: "true",
      OSVA_CONNECTOR_ZOHO_CRM_API_BASE_URL: "http://127.0.0.1:1/crm/v8",
    });
    expect(config.accessToken).toBe("token");
    expect(config.notesEnabled).toBe(false);
    expect(config.apiBaseUrl).toBe("http://127.0.0.1:1/crm/v8");
  });
  it("resolves us region to production host", () => {
    const config = loadZohoConfig({
      OSVA_CONNECTOR_ZOHO_CRM_ACCESS_TOKEN: "token",
      OSVA_CONNECTOR_ZOHO_CRM_REGION: "us",
    });
    expect(config.apiBaseUrl).toBe("https://www.zohoapis.com/crm/v8");
    expect(config.pinnedOrigin).toBe("https://www.zohoapis.com");
  });
});
