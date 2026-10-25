import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadGscConfig } from "../src/config.js";

describe("loadGscConfig", () => {
  it("loads defaults", () => {
    const config = loadGscConfig({});
    expect(config.requestTimeoutMs).toBe(30_000);
    expect(config.defaultSiteUrl).toBeUndefined();
  });

  it("parses default site URL", () => {
    const config = loadGscConfig({
      OSVA_CONNECTOR_GSC_SITE_URL: "https://example.com/",
    });
    expect(config.defaultSiteUrl).toBe("https://example.com/");
  });

  it("rejects invalid default site URL", () => {
    expect(() =>
      loadGscConfig({ OSVA_CONNECTOR_GSC_SITE_URL: "not-a-url" }),
    ).toThrow(ConnectorSdkError);
  });
});
