import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL,
  WHATSAPP_TEMPLATE_LIST_TOOL,
} from "../src/constants.js";
import { createWhatsAppConnector } from "../src/connector.js";
import {
  startMockWhatsAppHttpServer,
  type MockWhatsAppHttpServer,
} from "./fixtures/mock-whatsapp-http-server.js";
import {
  createTestWhatsAppClient,
  createTestWhatsAppConfig,
} from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockWhatsAppHttpServer | undefined;

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
    server = await startMockWhatsAppHttpServer();
    const client = createTestWhatsAppClient(server);
    const connector = createWhatsAppConnector({
      client,
      config: createTestWhatsAppConfig(),
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

  it("supports tools/list and tools/call", async () => {
    const mcpClient = await createLinkedClient();
    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL,
        WHATSAPP_TEMPLATE_LIST_TOOL,
      ]),
    );
    expect(names.length).toBe(8);

    const result = await mcpClient.callTool({
      name: WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
  });
});
