import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  BIGCOMMERCE_PRODUCT_GET_TOOL,
  BIGCOMMERCE_PRODUCT_UPDATE_TOOL,
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

describe("BigCommerce connector (fake HTTP provider)", () => {
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

  async function createLinkedClient(
    overrides?: Parameters<typeof createTestBigcommerceConfig>[0],
  ) {
    server = await startMockBigcommerceHttpServer();
    const client = createTestBigcommerceClient(server);
    const connector = createBigcommerceConnector({
      client,
      config: createTestBigcommerceConfig({
        apiHost: server.apiHost,
        storeHash: server.storeHash,
        ...overrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "bc-fake-test", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("gets catalog product when allowlist permits", async () => {
    const mcpClient = await createLinkedClient({ allowedProductIds: [101] });
    const result = await mcpClient.callTool({
      name: BIGCOMMERCE_PRODUCT_GET_TOOL,
      arguments: { productId: 101 },
    });
    expect(result.isError).not.toBe(true);
  });

  it("denies product get outside allowlist", async () => {
    const mcpClient = await createLinkedClient({ allowedProductIds: [999] });
    const result = await mcpClient.callTool({
      name: BIGCOMMERCE_PRODUCT_GET_TOOL,
      arguments: { productId: 101 },
    });
    expect(result.isError).toBe(true);
  });

  it("blocks mutations without host approval", async () => {
    const mcpClient = await createLinkedClient({
      allowedProductIds: [101],
      writeEnabled: true,
      hostWritesApproved: false,
    });
    const result = await mcpClient.callTool({
      name: BIGCOMMERCE_PRODUCT_UPDATE_TOOL,
      arguments: { productId: 101, price: 21.99 },
    });
    expect(result.isError).toBe(true);
  });
});
