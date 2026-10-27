import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadMetaAdsConfig } from "../src/config.js";
import {
  META_ADS_ACCESS_TOKEN_ENV,
  META_ADS_ALLOWED_ACCOUNTS_ENV,
  META_ADS_APP_SECRET_ENV,
} from "../src/constants.js";

describe("loadMetaAdsConfig", () => {
  it("loads token and optional allowlist", () => {
    const config = loadMetaAdsConfig({
      [META_ADS_ACCESS_TOKEN_ENV]: "fixture-token",
      [META_ADS_ALLOWED_ACCOUNTS_ENV]: "123, act_456",
      [META_ADS_APP_SECRET_ENV]: "secret",
    });
    expect(config.accessToken).toBe("fixture-token");
    expect(config.appSecret).toBe("secret");
    expect(config.allowedAccountIds).toEqual(["act_123", "act_456"]);
  });

  it("requires access token", () => {
    expect(() => loadMetaAdsConfig({})).toThrow(ConnectorSdkError);
  });
});
