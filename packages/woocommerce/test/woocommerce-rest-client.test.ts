import { afterEach, describe, expect, it } from "vitest";

import { createWoocommerceRestClient } from "../src/woocommerce-rest-client.js";
import {
  FAKE_WOOCOMMERCE_CONSUMER_KEY,
  FAKE_WOOCOMMERCE_CONSUMER_SECRET,
  startMockWoocommerceHttpServer,
  type MockWoocommerceHttpServer,
} from "./fixtures/mock-woocommerce-http-server.js";

describe("createWoocommerceRestClient", () => {
  let server: MockWoocommerceHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends Basic auth and hits products endpoint", async () => {
    server = await startMockWoocommerceHttpServer();
    const client = createWoocommerceRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      consumerKey: FAKE_WOOCOMMERCE_CONSUMER_KEY,
      consumerSecret: FAKE_WOOCOMMERCE_CONSUMER_SECRET,
      requestTimeoutMs: 5_000,
    });
    await client.listProducts({ page: 1, perPage: 10 });
    expect(server.getLastPathname()).toContain("/products");
    expect(server.getLastAuthorization()?.startsWith("Basic ")).toBe(true);
  });
});
