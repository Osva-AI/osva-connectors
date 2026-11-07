import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { parseHttpsTargetUrl } from "../src/url-target.js";

describe("parseHttpsTargetUrl", () => {
  it("accepts public https URLs", () => {
    const url = parseHttpsTargetUrl("https://example.com/path");
    expect(url).toBe("https://example.com/path");
  });

  it("normalizes bare hosts to https", () => {
    const url = parseHttpsTargetUrl("example.com/docs");
    expect(url).toBe("https://example.com/docs");
  });

  it("rejects http URLs", () => {
    expect(() => parseHttpsTargetUrl("http://example.com/")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects loopback hosts", () => {
    expect(() => parseHttpsTargetUrl("https://127.0.0.1/internal")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects metadata hosts", () => {
    expect(() =>
      parseHttpsTargetUrl(
        "https://metadata.google.internal/computeMetadata/v1/",
      ),
    ).toThrow(ConnectorSdkError);
  });
});
