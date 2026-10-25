import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { encodeSiteUrlForApiPath, parseSiteUrl } from "../src/site-url.js";

describe("site-url", () => {
  it("accepts URL-prefix and domain properties", () => {
    expect(parseSiteUrl("https://example.com/")).toBe("https://example.com/");
    expect(parseSiteUrl("sc-domain:example.com")).toBe("sc-domain:example.com");
  });

  it("rejects invalid properties", () => {
    expect(() => parseSiteUrl("ftp://example.com/")).toThrow(ConnectorSdkError);
    expect(() => parseSiteUrl("sc-domain:")).toThrow(ConnectorSdkError);
  });

  it("encodes path segments safely", () => {
    expect(encodeSiteUrlForApiPath("https://example.com/")).toBe(
      "https%3A%2F%2Fexample.com%2F",
    );
    expect(encodeSiteUrlForApiPath("sc-domain:example.com")).toBe(
      "sc-domain%3Aexample.com",
    );
  });
});
