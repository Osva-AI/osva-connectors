import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadHubspotConfig } from "../src/config.js";
import {
  HUBSPOT_ACCESS_TOKEN_ENV,
  HUBSPOT_INCLUDE_PII_ENV,
  HUBSPOT_MAX_ROWS_ENV,
  HUBSPOT_TIMEOUT_MS_ENV,
} from "../src/constants.js";

describe("loadHubspotConfig", () => {
  it("requires access token", () => {
    expect(() => loadHubspotConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads bounded timeout, max rows, and include PII flag", () => {
    const config = loadHubspotConfig({
      [HUBSPOT_ACCESS_TOKEN_ENV]: "pat-test-token",
      [HUBSPOT_TIMEOUT_MS_ENV]: "45000",
      [HUBSPOT_MAX_ROWS_ENV]: "200",
      [HUBSPOT_INCLUDE_PII_ENV]: "true",
    });
    expect(config.accessToken).toBe("pat-test-token");
    expect(config.requestTimeoutMs).toBe(45_000);
    expect(config.maxRows).toBe(200);
    expect(config.includePii).toBe(true);
    expect(config.allowedObjectTypes).toEqual([
      "contacts",
      "companies",
      "deals",
    ]);
  });
});
