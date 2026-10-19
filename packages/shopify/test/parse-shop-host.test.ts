import { describe, expect, it } from "vitest";

import { buildGraphqlEndpoint, parseShopHost } from "../src/parse-shop-host.js";

describe("parseShopHost", () => {
  it("accepts canonical shop handles", () => {
    expect(parseShopHost("Osva-Fixture").myshopifyDomain).toBe(
      "osva-fixture.myshopify.com",
    );
  });

  it("accepts myshopify.com domains over HTTPS without paths", () => {
    expect(
      parseShopHost("https://osva-fixture.myshopify.com").myshopifyDomain,
    ).toBe("osva-fixture.myshopify.com");
  });

  it("rejects non-myshopify hosts, paths, and credentials", () => {
    expect(() => parseShopHost("https://evil.example.com")).toThrow();
    expect(() => parseShopHost("https://shop.myshopify.com/admin")).toThrow();
    expect(() => parseShopHost("https://token@shop.myshopify.com")).toThrow();
    expect(() => parseShopHost("http://shop.myshopify.com")).toThrow();
    expect(() => parseShopHost("https://127.0.0.1.myshopify.com")).toThrow();
    expect(() => parseShopHost("https://shop.myshopify.com:8443")).toThrow();
  });

  it("builds fixed Admin GraphQL endpoints", () => {
    expect(buildGraphqlEndpoint("osva-fixture.myshopify.com", "2026-10")).toBe(
      "https://osva-fixture.myshopify.com/admin/api/2026-10/graphql.json",
    );
  });
});
