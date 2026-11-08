import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  FRESHDESK_TICKET_GET_TOOL,
  FRESHDESK_TICKET_LIST_TOOL,
  FRESHDESK_TICKET_NOTE_ADD_TOOL,
} from "../src/constants.js";
import { createFreshdeskConnector } from "../src/connector.js";
import {
  startMockFreshdeskHttpServer,
  type MockFreshdeskHttpServer,
} from "./fixtures/mock-freshdesk-http-server.js";
import {
  createTestFreshdeskClient,
  createTestFreshdeskConfig,
} from "./helpers/test-env.js";

describe("Freshdesk connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockFreshdeskHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestFreshdeskConfig>[0],
  ) {
    server = await startMockFreshdeskHttpServer();
    const client = createTestFreshdeskClient(server);
    const connector = createFreshdeskConnector({
      client,
      config: createTestFreshdeskConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "Freshdesk-fake", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("lists and gets tickets", async () => {
    const mcpClient = await createLinkedClient();
    const list = await mcpClient.callTool({
      name: FRESHDESK_TICKET_LIST_TOOL,
      arguments: { page: 1 },
    });
    expect(list.isError).not.toBe(true);
    const get = await mcpClient.callTool({
      name: FRESHDESK_TICKET_GET_TOOL,
      arguments: { ticketId: 1001 },
    });
    expect(get.isError).not.toBe(true);
  });

  it("blocks note mutations without gates", async () => {
    const mcpClient = await createLinkedClient({ allowedResourceIds: [1001] });
    const result = await mcpClient.callTool({
      name: FRESHDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: 1001, body: "note" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("FORBIDDEN");
  });
});
