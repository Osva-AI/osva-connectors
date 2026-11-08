import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  WOOCOMMERCE_CATEGORY_LIST_TOOL,
  WOOCOMMERCE_ORDER_LIST_TOOL,
  WOOCOMMERCE_PRODUCT_LIST_TOOL,
} from "../src/constants.js";
import { createWoocommerceConnector } from "../src/connector.js";
import {
  startMockWoocommerceHttpServer,
  type MockWoocommerceHttpServer,
} from "./fixtures/mock-woocommerce-http-server.js";
import {
  createTestWoocommerceClient,
  createTestWoocommerceConfig,
} from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  "woocommerce.product.list",
  "woocommerce.product.get",
  "woocommerce.product.variation.list",
  "woocommerce.product.variation.get",
  "woocommerce.category.list",
  "woocommerce.order.list",
  "woocommerce.order.get",
  "woocommerce.order.note.list",
  "woocommerce.product.update",
  "woocommerce.order.status.update",
];

describe("MCP compatibility", () => {
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

  async function createLinkedClient() {
    server = await startMockWoocommerceHttpServer();
    const client = createTestWoocommerceClient(server);
    const connector = createWoocommerceConnector({
      client,
      config: createTestWoocommerceConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        allowLocalHttp: true,
      }),
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

  it("exposes exactly ten tools", async () => {
    const mcpClient = await createLinkedClient();
    const listed = await mcpClient.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("invokes read tools", async () => {
    const mcpClient = await createLinkedClient();
    for (const name of [
      WOOCOMMERCE_PRODUCT_LIST_TOOL,
      WOOCOMMERCE_CATEGORY_LIST_TOOL,
      WOOCOMMERCE_ORDER_LIST_TOOL,
    ]) {
      const result = await mcpClient.callTool({ name, arguments: { page: 1 } });
      expect(result.isError).not.toBe(true);
    }
  });
});
