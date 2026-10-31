import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadNpmConfig } from "../src/config.js";
import { NPM_TIMEOUT_MS_ENV } from "../src/constants.js";

describe("loadNpmConfig", () => {
  it("uses defaults when env is empty", () => {
    const config = loadNpmConfig({});
    expect(config.requestTimeoutMs).toBe(10_000);
    expect(config.userAgent).toContain("@osva-ai/connector-npm");
  });

  it("rejects invalid timeout values", () => {
    expect(() =>
      loadNpmConfig({ [NPM_TIMEOUT_MS_ENV]: "not-a-number" }),
    ).toThrow(ConnectorSdkError);
  });
});
