import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadAmplitudeConfig } from "../src/config.js";
import {
  AMPLITUDE_ALLOWED_CHART_IDS_ENV,
  AMPLITUDE_API_KEY_ENV,
  AMPLITUDE_REGION_ENV,
  AMPLITUDE_SECRET_KEY_ENV,
  AMPLITUDE_TIMEOUT_MS_ENV,
} from "../src/constants.js";

describe("loadAmplitudeConfig", () => {
  it("requires API and secret keys", () => {
    expect(() => loadAmplitudeConfig({})).toThrow(ConnectorSdkError);
    expect(() =>
      loadAmplitudeConfig({ [AMPLITUDE_API_KEY_ENV]: "key" }),
    ).toThrow(ConnectorSdkError);
  });

  it("loads region, timeout, and chart allowlist", () => {
    const config = loadAmplitudeConfig({
      [AMPLITUDE_API_KEY_ENV]: "api-key",
      [AMPLITUDE_SECRET_KEY_ENV]: "secret-key",
      [AMPLITUDE_REGION_ENV]: "eu",
      [AMPLITUDE_TIMEOUT_MS_ENV]: "45000",
      [AMPLITUDE_ALLOWED_CHART_IDS_ENV]: "abc, def ,abc",
    });
    expect(config.region).toBe("eu");
    expect(config.requestTimeoutMs).toBe(45_000);
    expect(config.allowedChartIds).toEqual(["abc", "def"]);
  });

  it("treats empty chart allowlist as explicit empty array", () => {
    const config = loadAmplitudeConfig({
      [AMPLITUDE_API_KEY_ENV]: "api-key",
      [AMPLITUDE_SECRET_KEY_ENV]: "secret-key",
      [AMPLITUDE_ALLOWED_CHART_IDS_ENV]: "",
    });
    expect(config.allowedChartIds).toEqual([]);
  });
});
