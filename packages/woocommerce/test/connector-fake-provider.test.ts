import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  WOOCOMMERCE_ORDER_GET_TOOL,
  WOOCOMMERCE_PRODUCT_GET_TOOL,
  WOOCOMMERCE_PRODUCT_LIST_TOOL,
  WOOCOMMERCE_PRODUCT_UPDATE_TOOL,
} from "../src/constants.js";
import { createWoocommerceConnector } from "../src/connector.js";
import {
  startMockWoocommerceHttpServer,
  type MockWoocommerceHttpServer,
} from "./fixtures/mock-woocommerce-http-server.js";
import {
  createTestWoocommerceClient,
  createTestWoocommerceConfig,
  FAKE_WOOCOMMERCE_CONSUMER_KEY,
  FAKE_WOOCOMMERCE_CONSUMER_SECRET,
} from "./helpers/test-env.js";

describe("WooCommerce connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockWoocommerceHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestWoocommerceConfig>[0],
  ) {
    server = await startMockWoocommerceHttpServer();
    const client = createTestWoocommerceClient(server);
    const connector = createWoocommerceConnector({
      client,
      config: createTestWoocommerceConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        allowLocalHttp: true,
        ...configOverrides,
      }),
      credentialsForRedaction: {
        consumerKey: FAKE_WOOCOMMERCE_CONSUMER_KEY,
        consumerSecret: FAKE_WOOCOMMERCE_CONSUMER_SECRET,
      },
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "woo-fake-test", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("lists and gets catalog resources", async () => {
    const mcpClient = await createLinkedClient();
    const list = await mcpClient.callTool({
      name: WOOCOMMERCE_PRODUCT_LIST_TOOL,
      arguments: { page: 1, limit: 10 },
    });
    expect(list.isError).not.toBe(true);

    const get = await mcpClient.callTool({
      name: WOOCOMMERCE_PRODUCT_GET_TOOL,
      arguments: { productId: 101 },
    });
    expect(get.isError).not.toBe(true);
  });

  it("denies product get when allowlist excludes id", async () => {
    const mcpClient = await createLinkedClient({
      allowedProductIds: [999],
    });
    const get = await mcpClient.callTool({
      name: WOOCOMMERCE_PRODUCT_GET_TOOL,
      arguments: { productId: 101 },
    });
    expect(get.isError).toBe(true);
    expect(JSON.stringify(get.content)).toContain("FORBIDDEN");
  });

  it("blocks mutations without host approval", async () => {
    const mcpClient = await createLinkedClient({
      allowedProductIds: [101],
      writeEnabled: true,
      hostWritesApproved: false,
    });
    const result = await mcpClient.callTool({
      name: WOOCOMMERCE_PRODUCT_UPDATE_TOOL,
      arguments: { productId: 101, regular_price: "21.99" },
    });
    expect(result.isError).toBe(true);
  });

  it("strips order PII by default", async () => {
    const mcpClient = await createLinkedClient({
      allowedOrderIds: [501],
    });
    const result = await mcpClient.callTool({
      name: WOOCOMMERCE_ORDER_GET_TOOL,
      arguments: { orderId: 501 },
    });
    expect(result.isError).not.toBe(true);
  });
});
