import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadWoocommerceConfig } from "../src/config.js";
import {
  WOOCOMMERCE_ALLOW_LOCAL_HTTP_ENV,
  WOOCOMMERCE_ALLOWED_PRODUCT_IDS_ENV,
  WOOCOMMERCE_CONSUMER_KEY_ENV,
  WOOCOMMERCE_CONSUMER_SECRET_ENV,
  WOOCOMMERCE_STORE_URL_ENV,
  WOOCOMMERCE_WRITE_ENABLED_ENV,
} from "../src/constants.js";

describe("loadWoocommerceConfig", () => {
  it("requires store URL and credentials", () => {
    expect(() => loadWoocommerceConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads localhost when allow-local-http is true", () => {
    const config = loadWoocommerceConfig({
      [WOOCOMMERCE_STORE_URL_ENV]: "http://127.0.0.1/wp-json/wc/v3",
      [WOOCOMMERCE_CONSUMER_KEY_ENV]: "ck_test",
      [WOOCOMMERCE_CONSUMER_SECRET_ENV]: "cs_test",
      [WOOCOMMERCE_ALLOW_LOCAL_HTTP_ENV]: "true",
    });
    expect(config.pinnedOrigin).toBe("http://127.0.0.1");
    expect(config.writeEnabled).toBe(false);
  });

  it("tri-state product allowlist: empty string deny all", () => {
    const config = loadWoocommerceConfig({
      [WOOCOMMERCE_STORE_URL_ENV]: "http://127.0.0.1/wp-json/wc/v3",
      [WOOCOMMERCE_CONSUMER_KEY_ENV]: "ck",
      [WOOCOMMERCE_CONSUMER_SECRET_ENV]: "cs",
      [WOOCOMMERCE_ALLOW_LOCAL_HTTP_ENV]: "true",
      [WOOCOMMERCE_ALLOWED_PRODUCT_IDS_ENV]: "",
    });
    expect(config.allowedProductIds).toEqual([]);
  });

  it("rejects empty writable fields allowlist when set", () => {
    expect(() =>
      loadWoocommerceConfig({
        [WOOCOMMERCE_STORE_URL_ENV]: "http://127.0.0.1/wp-json/wc/v3",
        [WOOCOMMERCE_CONSUMER_KEY_ENV]: "ck",
        [WOOCOMMERCE_CONSUMER_SECRET_ENV]: "cs",
        [WOOCOMMERCE_ALLOW_LOCAL_HTTP_ENV]: "true",
        OSVA_CONNECTOR_WOOCOMMERCE_WRITABLE_PRODUCT_FIELDS: "",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("defaults mutations disabled", () => {
    const config = loadWoocommerceConfig({
      [WOOCOMMERCE_STORE_URL_ENV]: "http://127.0.0.1/wp-json/wc/v3",
      [WOOCOMMERCE_CONSUMER_KEY_ENV]: "ck",
      [WOOCOMMERCE_CONSUMER_SECRET_ENV]: "cs",
      [WOOCOMMERCE_ALLOW_LOCAL_HTTP_ENV]: "true",
      [WOOCOMMERCE_WRITE_ENABLED_ENV]: "false",
    });
    expect(config.hostWritesApproved).toBe(false);
  });
});
