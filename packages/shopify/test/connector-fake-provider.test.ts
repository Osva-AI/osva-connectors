import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SHOPIFY_INVENTORY_LEVELS_LIST_TOOL,
  SHOPIFY_LOCATION_LIST_TOOL,
  SHOPIFY_ORDER_GET_TOOL,
  SHOPIFY_ORDER_LIST_TOOL,
  SHOPIFY_PRODUCT_GET_TOOL,
  SHOPIFY_PRODUCT_LIST_TOOL,
  SHOPIFY_SHOP_GET_TOOL,
} from "../src/constants.js";
import { createShopifyConnector } from "../src/connector.js";
import { mapShopifyError } from "../src/map-shopify-error.js";
import { createShopifyGraphqlClient } from "../src/shopify-graphql-client.js";
import {
  FAKE_SHOPIFY_ACCESS_TOKEN,
  MOCK_SHOP,
  startMockShopifyHttpServer,
  type MockShopifyHttpServer,
} from "./fixtures/mock-shopify-http-server.js";

describe("Shopify connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockShopifyHttpServer | undefined;

  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map(async (client) => {
        try {
          await client.close();
        } catch {
          // ignore
        }
      }),
    );
    await server?.close();
    server = undefined;
  });

  async function createLinkedClient(
    mode?: Parameters<typeof startMockShopifyHttpServer>[0],
  ) {
    server = await startMockShopifyHttpServer(mode);
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const connector = createShopifyConnector({
      client,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({
      name: "fake-provider-test",
      version: "1.0",
    });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  async function callTool(
    mcpClient: Client,
    name: string,
    arguments_: Record<string, unknown>,
  ) {
    return mcpClient.callTool({ name, arguments: arguments_ });
  }

  it("exercises all seven tools against the fake provider", async () => {
    const mcpClient = await createLinkedClient();

    const shop = await callTool(mcpClient, SHOPIFY_SHOP_GET_TOOL, {});
    expect(shop.isError).not.toBe(true);
    expect(shop.structuredContent).toMatchObject({ name: MOCK_SHOP.name });

    const products = await callTool(mcpClient, SHOPIFY_PRODUCT_LIST_TOOL, {
      limit: 10,
    });
    expect(products.isError).not.toBe(true);
    expect(products.structuredContent).toMatchObject({
      pageInfo: expect.objectContaining({ hasNextPage: true }),
    });

    const product = await callTool(mcpClient, SHOPIFY_PRODUCT_GET_TOOL, {
      id: "gid://shopify/Product/100",
    });
    expect(product.isError).not.toBe(true);

    const orders = await callTool(mcpClient, SHOPIFY_ORDER_LIST_TOOL, {});
    expect(orders.isError).not.toBe(true);

    const order = await callTool(mcpClient, SHOPIFY_ORDER_GET_TOOL, {
      id: "gid://shopify/Order/500",
    });
    expect(order.isError).not.toBe(true);
    expect(JSON.stringify(order)).not.toMatch(/customer|email|phone|address/i);

    const locations = await callTool(mcpClient, SHOPIFY_LOCATION_LIST_TOOL, {});
    expect(locations.isError).not.toBe(true);

    const byLocation = await callTool(
      mcpClient,
      SHOPIFY_INVENTORY_LEVELS_LIST_TOOL,
      { locationId: "gid://shopify/Location/10" },
    );
    expect(byLocation.isError).not.toBe(true);

    const byItem = await callTool(
      mcpClient,
      SHOPIFY_INVENTORY_LEVELS_LIST_TOOL,
      { inventoryItemId: "gid://shopify/InventoryItem/77" },
    );
    expect(byItem.isError).not.toBe(true);

    expect(JSON.stringify({ shop, product, order })).not.toContain(
      FAKE_SHOPIFY_ACCESS_TOKEN,
    );
  });

  it("maps permission failures without leaking credentials", async () => {
    server = await startMockShopifyHttpServer({
      mode: "graphql_access_denied",
    });
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    await expect(client.listOrders({ limit: 5 })).rejects.toSatisfy(
      (error: unknown) => {
        const mapped = mapShopifyError(error, {
          accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
        });
        expect(mapped.code).toBe("FORBIDDEN");
        expect(JSON.stringify(mapped)).not.toContain(FAKE_SHOPIFY_ACCESS_TOKEN);
        return true;
      },
    );
  });

  it("propagates caller cancellation", async () => {
    server = await startMockShopifyHttpServer({
      mode: "slow",
      slowDelayMs: 2_000,
    });
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const controller = new AbortController();
    const pending = client.getShop({ signal: controller.signal });
    controller.abort();
    try {
      await pending;
      throw new Error("expected abort");
    } catch (error) {
      const mapped = mapShopifyError(error);
      expect(mapped.code).toBe("CANCELLED");
    }
  });

  it("retries throttled read-only GraphQL once then succeeds", async () => {
    server = await startMockShopifyHttpServer({
      mode: "graphql_throttle_once",
    });
    const client = createShopifyGraphqlClient({
      graphqlEndpoint: server.graphqlUrl,
      accessToken: FAKE_SHOPIFY_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const data = (await client.getShop({})) as { shop: typeof MOCK_SHOP };
    expect(data.shop.name).toBe(MOCK_SHOP.name);
    expect(server.getRequestCount()).toBe(2);
  });
});
