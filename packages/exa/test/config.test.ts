import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadExaConfig } from "../src/config.js";
import { EXA_API_KEY_ENV, EXA_TIMEOUT_MS_ENV } from "../src/constants.js";

describe("loadExaConfig", () => {
  it("requires API key", () => {
    expect(() => loadExaConfig({})).toThrow(ConnectorSdkError);
  });

  it("rejects non-integer timeout", () => {
    expect(() =>
      loadExaConfig({
        [EXA_API_KEY_ENV]: "exa_test_key",
        [EXA_TIMEOUT_MS_ENV]: "fast",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("loads valid configuration", () => {
    const config = loadExaConfig({
      [EXA_API_KEY_ENV]: "exa_test_key",
      [EXA_TIMEOUT_MS_ENV]: "45000",
    });
    expect(config.apiKey).toBe("exa_test_key");
    expect(config.requestTimeoutMs).toBe(45_000);
  });
});
