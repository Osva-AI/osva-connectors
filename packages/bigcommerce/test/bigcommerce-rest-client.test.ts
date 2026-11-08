import { afterEach, describe, expect, it } from "vitest";

import { createBigcommerceRestClient } from "../src/bigcommerce-rest-client.js";
import {
  FAKE_BIGCOMMERCE_ACCESS_TOKEN,
  startMockBigcommerceHttpServer,
  type MockBigcommerceHttpServer,
} from "./fixtures/mock-bigcommerce-http-server.js";

describe("createBigcommerceRestClient", () => {
  let server: MockBigcommerceHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends X-Auth-Token and lists products", async () => {
    server = await startMockBigcommerceHttpServer();
    const client = createBigcommerceRestClient({
      apiHost: server.apiHost,
      storeHash: server.storeHash,
      accessToken: FAKE_BIGCOMMERCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    await client.listProducts({ page: 1, limit: 10 });
    expect(server.getLastPathname()).toContain("/v3/catalog/products");
    expect(server.getLastToken()).toBe(FAKE_BIGCOMMERCE_ACCESS_TOKEN);
  });
});
