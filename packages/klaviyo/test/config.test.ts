import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadKlaviyoConfig } from "../src/config.js";
import {
  KLAVIYO_MAX_ROWS_ENV,
  KLAVIYO_PRIVATE_API_KEY_ENV,
  KLAVIYO_TIMEOUT_MS_ENV,
} from "../src/constants.js";

describe("loadKlaviyoConfig", () => {
  it("requires private API key", () => {
    expect(() => loadKlaviyoConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads bounded timeout and max rows", () => {
    const config = loadKlaviyoConfig({
      [KLAVIYO_PRIVATE_API_KEY_ENV]: "pk_test_key",
      [KLAVIYO_TIMEOUT_MS_ENV]: "45000",
      [KLAVIYO_MAX_ROWS_ENV]: "200",
    });
    expect(config.privateApiKey).toBe("pk_test_key");
    expect(config.requestTimeoutMs).toBe(45_000);
    expect(config.maxRows).toBe(200);
  });
});
