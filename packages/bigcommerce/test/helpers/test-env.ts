import { createBigcommerceRestClient } from "../../src/bigcommerce-rest-client.js";
import type { BigcommerceConfig } from "../../src/schemas.js";
import {
  FAKE_BIGCOMMERCE_ACCESS_TOKEN,
  FAKE_STORE_HASH,
  type MockBigcommerceHttpServer,
} from "../fixtures/mock-bigcommerce-http-server.js";

export function createTestBigcommerceClient(server: MockBigcommerceHttpServer) {
  return createBigcommerceRestClient({
    apiHost: server.apiHost,
    storeHash: server.storeHash,
    accessToken: FAKE_BIGCOMMERCE_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
  });
}

export function createTestBigcommerceConfig(
  overrides: Partial<BigcommerceConfig> = {},
): BigcommerceConfig {
  return {
    apiHost: "http://127.0.0.1",
    storeHash: FAKE_STORE_HASH,
    accessToken: FAKE_BIGCOMMERCE_ACCESS_TOKEN,
    writeEnabled: false,
    hostWritesApproved: false,
    includeOrderPii: false,
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}

export { FAKE_BIGCOMMERCE_ACCESS_TOKEN, FAKE_STORE_HASH };
