import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadGoogleAdsConfig } from "../src/config.js";
import {
  GOOGLE_ADS_ALLOWED_CUSTOMERS_ENV,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID_ENV,
} from "../src/constants.js";

describe("loadGoogleAdsConfig", () => {
  it("parses allowlist and login customer id", () => {
    const config = loadGoogleAdsConfig({
      [GOOGLE_ADS_LOGIN_CUSTOMER_ID_ENV]: "1234567890",
      [GOOGLE_ADS_ALLOWED_CUSTOMERS_ENV]: "1234567890,9876543210",
      OSVA_CONNECTOR_GOOGLE_ADS_MAX_ROWS: "250",
    });
    expect(config.loginCustomerId).toBe("1234567890");
    expect(config.allowedCustomerIds).toEqual(["1234567890", "9876543210"]);
    expect(config.maxRows).toBe(250);
  });

  it("rejects invalid customer ids in allowlist", () => {
    expect(() =>
      loadGoogleAdsConfig({
        [GOOGLE_ADS_ALLOWED_CUSTOMERS_ENV]: "not-a-customer",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
