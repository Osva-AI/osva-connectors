import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadGa4Config } from "../src/config.js";
import { GA4_PROPERTY_ID_ENV, GA4_TIMEOUT_MS_ENV } from "../src/constants.js";

describe("loadGa4Config", () => {
  it("loads optional default property and timeout", () => {
    const config = loadGa4Config({
      [GA4_PROPERTY_ID_ENV]: "123456789",
      [GA4_TIMEOUT_MS_ENV]: "45000",
    });
    expect(config.defaultPropertyId).toBe("123456789");
    expect(config.requestTimeoutMs).toBe(45_000);
  });

  it("rejects invalid property id", () => {
    expect(() =>
      loadGa4Config({ [GA4_PROPERTY_ID_ENV]: "not-numeric" }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects non-integer timeout", () => {
    expect(() => loadGa4Config({ [GA4_TIMEOUT_MS_ENV]: "12.5" })).toThrow(
      ConnectorSdkError,
    );
  });
});
