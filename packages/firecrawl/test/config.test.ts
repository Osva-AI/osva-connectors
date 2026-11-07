import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadFirecrawlConfig } from "../src/config.js";
import {
  FIRECRAWL_API_KEY_ENV,
  FIRECRAWL_TIMEOUT_MS_ENV,
} from "../src/constants.js";

describe("loadFirecrawlConfig", () => {
  it("requires API key", () => {
    expect(() => loadFirecrawlConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads bounded timeout", () => {
    const config = loadFirecrawlConfig({
      [FIRECRAWL_API_KEY_ENV]: "fc_test_key",
      [FIRECRAWL_TIMEOUT_MS_ENV]: "45000",
    });
    expect(config.apiKey).toBe("fc_test_key");
    expect(config.requestTimeoutMs).toBe(45_000);
  });
});
