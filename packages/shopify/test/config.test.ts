import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadShopifyConfig } from "../src/config.js";
import {
  SHOPIFY_ACCESS_TOKEN_ENV,
  SHOPIFY_SHOP_ENV,
} from "../src/constants.js";
import {
  TEST_SHOPIFY_SHOP,
  TEST_SHOPIFY_TOKEN,
  withTestShopifyEnv,
} from "./helpers/test-env.js";

describe("loadShopifyConfig", () => {
  it("loads shop, token, and default API version", () => {
    const config = withTestShopifyEnv((env) => loadShopifyConfig(env));
    expect(config.myshopifyDomain).toBe(TEST_SHOPIFY_SHOP);
    expect(config.accessToken).toBe(TEST_SHOPIFY_TOKEN);
    expect(config.apiVersion).toBe("2026-10");
    expect(config.graphqlEndpoint).toBe(
      `https://${TEST_SHOPIFY_SHOP}/admin/api/2026-10/graphql.json`,
    );
  });

  it("rejects missing shop or token without echoing secrets", () => {
    expect(() => loadShopifyConfig({})).toThrow(ConnectorSdkError);
    try {
      loadShopifyConfig({
        [SHOPIFY_SHOP_ENV]: TEST_SHOPIFY_SHOP,
        [SHOPIFY_ACCESS_TOKEN_ENV]: "   ",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorSdkError);
      expect((error as ConnectorSdkError).message).not.toContain("   ");
      expect(JSON.stringify(error)).not.toContain(TEST_SHOPIFY_TOKEN);
    }
  });

  it("rejects invalid shop hosts", () => {
    expect(() =>
      loadShopifyConfig({
        [SHOPIFY_SHOP_ENV]: "https://evil.example.com",
        [SHOPIFY_ACCESS_TOKEN_ENV]: TEST_SHOPIFY_TOKEN,
      }),
    ).toThrow(ConnectorSdkError);
  });
});
