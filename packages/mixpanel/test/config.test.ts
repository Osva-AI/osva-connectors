import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadMixpanelConfig } from "../src/config.js";
import {
  MIXPANEL_ALLOWED_BOOKMARK_IDS_ENV,
  MIXPANEL_ALLOWED_FUNNEL_IDS_ENV,
  MIXPANEL_PROJECT_ID_ENV,
  MIXPANEL_REGION_ENV,
  MIXPANEL_SERVICE_ACCOUNT_SECRET_ENV,
  MIXPANEL_SERVICE_ACCOUNT_USERNAME_ENV,
  MIXPANEL_TIMEOUT_MS_ENV,
} from "../src/constants.js";

const baseEnv = {
  [MIXPANEL_SERVICE_ACCOUNT_USERNAME_ENV]: "svc-user",
  [MIXPANEL_SERVICE_ACCOUNT_SECRET_ENV]: "svc-secret",
  [MIXPANEL_PROJECT_ID_ENV]: "42",
};

describe("loadMixpanelConfig", () => {
  it("loads required credentials and project", () => {
    const config = loadMixpanelConfig(baseEnv);
    expect(config.projectId).toBe(42);
    expect(config.region).toBe("us");
    expect(config.allowedBookmarkIds).toBeUndefined();
  });

  it("parses region, timeout, and allowlists", () => {
    const config = loadMixpanelConfig({
      ...baseEnv,
      [MIXPANEL_REGION_ENV]: "eu",
      [MIXPANEL_TIMEOUT_MS_ENV]: "45000",
      [MIXPANEL_ALLOWED_BOOKMARK_IDS_ENV]: "1, 2",
      [MIXPANEL_ALLOWED_FUNNEL_IDS_ENV]: "",
    });
    expect(config.region).toBe("eu");
    expect(config.requestTimeoutMs).toBe(45_000);
    expect(config.allowedBookmarkIds).toEqual(["1", "2"]);
    expect(config.allowedFunnelIds).toEqual([]);
  });

  it("rejects missing project id", () => {
    expect(() =>
      loadMixpanelConfig({ ...baseEnv, [MIXPANEL_PROJECT_ID_ENV]: "" }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects invalid region", () => {
    expect(() =>
      loadMixpanelConfig({ ...baseEnv, [MIXPANEL_REGION_ENV]: "ap" }),
    ).toThrow(ConnectorSdkError);
  });
});
