import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { SHOP_GET_QUERY } from "../src/graphql/queries.js";
import { mapShopifyError } from "../src/map-shopify-error.js";
import { createShopifyGraphqlClient } from "../src/shopify-graphql-client.js";
import {
  FAKE_SHOPIFY_ACCESS_TOKEN,
  MOCK_SHOP,
  startMockShopifyHttpServer,
  type MockShopifyHttpServer,
} from "./fixtures/mock-shopify-http-server.js";

describe("createShopifyGraphqlClient", () => {
  let server: MockShopifyHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends authenticated POST requests and parses GraphQL data", async () => {
    server = await startMockShopifyHttpServer();
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });

    const data = await client.executeGraphql<{ shop: typeof MOCK_SHOP }>({
      query: SHOP_GET_QUERY,
    });
    expect(data.shop.name).toBe(MOCK_SHOP.name);
    expect(server.getLastAuthorization()).toBe(FAKE_SHOPIFY_ACCESS_TOKEN);
    expect(JSON.stringify(data)).not.toContain(FAKE_SHOPIFY_ACCESS_TOKEN);
  });

  it("maps HTTP auth failures without leaking tokens", async () => {
    server = await startMockShopifyHttpServer({ mode: "unauthorized" });
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });

    try {
      await client.getShop({});
    } catch (error) {
      const mapped = mapShopifyError(error, {
        accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      });
      expect(mapped.code).toBe("UNAUTHORIZED");
      expect(JSON.stringify(mapped)).not.toContain(FAKE_SHOPIFY_ACCESS_TOKEN);
    }
  });

  it("rejects oversized HTTP bodies", async () => {
    server = await startMockShopifyHttpServer({ mode: "oversized" });
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });

    await expect(client.getShop({})).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("maps GraphQL throttling metadata", async () => {
    server = await startMockShopifyHttpServer({ mode: "graphql_throttled" });
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });

    try {
      await client.getShop({});
    } catch (error) {
      const mapped = mapShopifyError(error);
      expect(mapped.code).toBe("RATE_LIMITED");
    }
  });

  it("times out hung responses", async () => {
    server = await startMockShopifyHttpServer({
      mode: "slow",
      slowDelayMs: 500,
    });
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 50,
    });

    try {
      await client.getShop({});
    } catch (error) {
      const mapped = mapShopifyError(error);
      expect(mapped.code).toBe("TIMEOUT");
    }
  });
});
