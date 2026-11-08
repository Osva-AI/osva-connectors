import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";
import { loadIntercomConfig } from "../src/config.js";

describe("loadIntercomConfig", () => {
  it("requires token, region, and admin id", () => {
    expect(() => loadIntercomConfig({})).toThrow(ConnectorSdkError);
  });
  it("loads with test api base", () => {
    const config = loadIntercomConfig({
      OSVA_CONNECTOR_INTERCOM_ACCESS_TOKEN: "token",
      OSVA_CONNECTOR_INTERCOM_REGION: "us",
      OSVA_CONNECTOR_INTERCOM_ADMIN_ID: "admin_1",
      OSVA_CONNECTOR_INTERCOM_ALLOW_TEST_API_HOST: "true",
      OSVA_CONNECTOR_INTERCOM_API_BASE_URL: "http://127.0.0.1:1",
    });
    expect(config.accessToken).toBe("token");
    expect(config.adminId).toBe("admin_1");
    expect(config.notesEnabled).toBe(false);
  });
});
