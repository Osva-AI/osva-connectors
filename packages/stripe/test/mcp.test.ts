import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  STRIPE_ACCOUNT_GET_TOOL,
  STRIPE_BALANCE_GET_TOOL,
} from "../src/constants.js";
import { createStripeConnector } from "../src/connector.js";
import {
  startMockStripeHttpServer,
  type MockStripeHttpServer,
} from "./fixtures/mock-stripe-http-server.js";
import { createTestStripeClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockStripeHttpServer | undefined;

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
    server = await startMockStripeHttpServer();
    const client = createTestStripeClient(server);
    const connector = createStripeConnector({ client });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("supports tools/list and tools/call", async () => {
    const mcpClient = await createLinkedClient();
    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        STRIPE_ACCOUNT_GET_TOOL,
        STRIPE_BALANCE_GET_TOOL,
      ]),
    );
    expect(names.length).toBe(10);

    const result = await mcpClient.callTool({
      name: STRIPE_ACCOUNT_GET_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
  });
});
