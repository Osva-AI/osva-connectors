import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { parseWoocommerceStoreUrl } from "../src/woocommerce-base-url.js";

describe("parseWoocommerceStoreUrl", () => {
  it("pins origin and normalizes wc/v3 base path", () => {
    const result = parseWoocommerceStoreUrl("https://shop.example.com", false);
    expect(result.pinnedOrigin).toBe("https://shop.example.com");
    expect(result.apiBaseUrl).toContain("/wp-json/wc/v3");
  });

  it("rejects credentials embedded in store URL", () => {
    expect(() =>
      parseWoocommerceStoreUrl("https://user:pass@shop.example.com", false),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects query strings and fragments (SSRF hardening)", () => {
    expect(() =>
      parseWoocommerceStoreUrl("https://shop.example.com?x=1", false),
    ).toThrow(ConnectorSdkError);
    expect(() =>
      parseWoocommerceStoreUrl("https://shop.example.com#frag", false),
    ).toThrow(ConnectorSdkError);
  });

  it("requires HTTPS for non-loopback hosts", () => {
    expect(() =>
      parseWoocommerceStoreUrl("http://shop.example.com", false),
    ).toThrow(ConnectorSdkError);
  });

  it("allows loopback HTTP when explicitly enabled", () => {
    const result = parseWoocommerceStoreUrl("http://127.0.0.1", true);
    expect(result.pinnedOrigin).toBe("http://127.0.0.1");
  });
});
