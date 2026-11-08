import { createWoocommerceRestClient } from "../../src/woocommerce-rest-client.js";
import type { WoocommerceConfig } from "../../src/schemas.js";
import {
  FAKE_WOOCOMMERCE_CONSUMER_KEY,
  FAKE_WOOCOMMERCE_CONSUMER_SECRET,
  type MockWoocommerceHttpServer,
} from "../fixtures/mock-woocommerce-http-server.js";

export function createTestWoocommerceClient(server: MockWoocommerceHttpServer) {
  return createWoocommerceRestClient({
    apiBaseUrl: server.apiBaseUrl,
    pinnedOrigin: server.pinnedOrigin,
    consumerKey: FAKE_WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: FAKE_WOOCOMMERCE_CONSUMER_SECRET,
    requestTimeoutMs: 5_000,
  });
}

export function createTestWoocommerceConfig(
  overrides: Partial<WoocommerceConfig> = {},
): WoocommerceConfig {
  return {
    apiBaseUrl: "http://127.0.0.1/wp-json/wc/v3",
    pinnedOrigin: "http://127.0.0.1",
    consumerKey: FAKE_WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: FAKE_WOOCOMMERCE_CONSUMER_SECRET,
    allowLocalHttp: true,
    writableProductFields: ["regular_price", "sale_price", "status"],
    writeEnabled: false,
    hostWritesApproved: false,
    includeOrderPii: false,
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}

export { FAKE_WOOCOMMERCE_CONSUMER_KEY, FAKE_WOOCOMMERCE_CONSUMER_SECRET };
