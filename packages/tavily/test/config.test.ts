import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadTavilyConfig } from "../src/config.js";
import { TAVILY_API_KEY_ENV, TAVILY_TIMEOUT_MS_ENV } from "../src/constants.js";

describe("loadTavilyConfig", () => {
  it("requires API key", () => {
    expect(() => loadTavilyConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads timeout from env", () => {
    const config = loadTavilyConfig({
      [TAVILY_API_KEY_ENV]: "tvly_test",
      [TAVILY_TIMEOUT_MS_ENV]: "45000",
    });
    expect(config.requestTimeoutMs).toBe(45_000);
  });

  it("rejects non-integer timeout", () => {
    expect(() =>
      loadTavilyConfig({
        [TAVILY_API_KEY_ENV]: "tvly_test",
        [TAVILY_TIMEOUT_MS_ENV]: "abc",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
