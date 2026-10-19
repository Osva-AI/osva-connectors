import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SHOPIFY_ORDER_LIST_TOOL,
  SHOPIFY_PRODUCT_LIST_TOOL,
  SHOPIFY_SHOP_GET_TOOL,
} from "../src/constants.js";
import { createShopifyConnector } from "../src/connector.js";
import { createShopifyGraphqlClient } from "../src/shopify-graphql-client.js";
import {
  FAKE_SHOPIFY_ACCESS_TOKEN,
  MOCK_SHOP,
  startMockShopifyHttpServer,
  type MockShopifyHttpServer,
} from "./fixtures/mock-shopify-http-server.js";

describe("MCP compatibility", () => {
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

  async function createLinkedClient() {
    server = await startMockShopifyHttpServer();
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
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("supports tools/list and tools/call for shopify.shop.get", async () => {
    const mcpClient = await createLinkedClient();
    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        SHOPIFY_SHOP_GET_TOOL,
        SHOPIFY_PRODUCT_LIST_TOOL,
        SHOPIFY_ORDER_LIST_TOOL,
      ]),
    );
    expect(new Set(names).size).toBe(names.length);

    const result = await mcpClient.callTool({
      name: SHOPIFY_SHOP_GET_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      name: MOCK_SHOP.name,
      myshopifyDomain: MOCK_SHOP.myshopifyDomain,
    });
    expect(JSON.stringify(result)).not.toContain(FAKE_SHOPIFY_ACCESS_TOKEN);
  });

  it("calls shopify.product.list with default limit", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: SHOPIFY_PRODUCT_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      products: expect.any(Array),
      pageInfo: expect.objectContaining({ hasNextPage: true }),
    });
  });
});
