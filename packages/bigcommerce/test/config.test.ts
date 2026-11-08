import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadBigcommerceConfig } from "../src/config.js";
import {
  BIGCOMMERCE_ACCESS_TOKEN_ENV,
  BIGCOMMERCE_ALLOW_TEST_API_HOST_ENV,
  BIGCOMMERCE_STORE_HASH_ENV,
} from "../src/constants.js";

describe("loadBigcommerceConfig", () => {
  it("requires store hash and access token", () => {
    expect(() => loadBigcommerceConfig({})).toThrow(ConnectorSdkError);
  });

  it("allows test API host override when explicitly enabled", () => {
    const config = loadBigcommerceConfig({
      [BIGCOMMERCE_STORE_HASH_ENV]: "abc123",
      [BIGCOMMERCE_ACCESS_TOKEN_ENV]: "token",
      [BIGCOMMERCE_ALLOW_TEST_API_HOST_ENV]: "true",
      OSVA_CONNECTOR_BIGCOMMERCE_API_HOST: "http://127.0.0.1:9",
    });
    expect(config.apiHost).toBe("http://127.0.0.1:9");
    expect(config.writeEnabled).toBe(false);
  });

  it("rejects test API host without flag", () => {
    expect(() =>
      loadBigcommerceConfig({
        [BIGCOMMERCE_STORE_HASH_ENV]: "abc123",
        [BIGCOMMERCE_ACCESS_TOKEN_ENV]: "token",
        OSVA_CONNECTOR_BIGCOMMERCE_API_HOST: "http://127.0.0.1:9",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
