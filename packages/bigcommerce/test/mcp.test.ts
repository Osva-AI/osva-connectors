import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  BIGCOMMERCE_ORDER_LIST_TOOL,
  BIGCOMMERCE_PRODUCT_LIST_TOOL,
} from "../src/constants.js";
import { createBigcommerceConnector } from "../src/connector.js";
import {
  startMockBigcommerceHttpServer,
  type MockBigcommerceHttpServer,
} from "./fixtures/mock-bigcommerce-http-server.js";
import {
  createTestBigcommerceClient,
  createTestBigcommerceConfig,
} from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  "bigcommerce.product.list",
  "bigcommerce.product.get",
  "bigcommerce.product.variant.list",
  "bigcommerce.category.tree.list",
  "bigcommerce.category.list",
  "bigcommerce.order.list",
  "bigcommerce.order.get",
  "bigcommerce.order.product.list",
  "bigcommerce.product.update",
  "bigcommerce.order.status.update",
];

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockBigcommerceHttpServer | undefined;

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
    server = await startMockBigcommerceHttpServer();
    const client = createTestBigcommerceClient(server);
    const connector = createBigcommerceConnector({
      client,
      config: createTestBigcommerceConfig({
        apiHost: server.apiHost,
        storeHash: server.storeHash,
      }),
      accessTokenForRedaction: "token",
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
      BIGCOMMERCE_PRODUCT_LIST_TOOL,
      BIGCOMMERCE_ORDER_LIST_TOOL,
    ]) {
      const result = await mcpClient.callTool({ name, arguments: { page: 1 } });
      expect(result.isError).not.toBe(true);
    }
  });
});
