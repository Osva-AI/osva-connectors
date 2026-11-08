import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  ZENDESK_TICKET_GET_TOOL,
  ZENDESK_TICKET_LIST_TOOL,
  ZENDESK_TICKET_NOTE_ADD_TOOL,
} from "../src/constants.js";
import { createZendeskConnector } from "../src/connector.js";
import {
  startMockZendeskHttpServer,
  type MockZendeskHttpServer,
} from "./fixtures/mock-zendesk-http-server.js";
import {
  createTestZendeskClient,
  createTestZendeskConfig,
} from "./helpers/test-env.js";

describe("Zendesk connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockZendeskHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestZendeskConfig>[0],
  ) {
    server = await startMockZendeskHttpServer();
    const client = createTestZendeskClient(server);
    const connector = createZendeskConnector({
      client,
      config: createTestZendeskConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "zendesk-fake", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("lists and gets tickets", async () => {
    const mcpClient = await createLinkedClient();
    const list = await mcpClient.callTool({
      name: ZENDESK_TICKET_LIST_TOOL,
      arguments: { limit: 20 },
    });
    expect(list.isError).not.toBe(true);
    const get = await mcpClient.callTool({
      name: ZENDESK_TICKET_GET_TOOL,
      arguments: { ticketId: 1001 },
    });
    expect(get.isError).not.toBe(true);
  });

  it("blocks note mutations without gates", async () => {
    const mcpClient = await createLinkedClient({ allowedResourceIds: [1001] });
    const result = await mcpClient.callTool({
      name: ZENDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: 1001, body: "note" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("FORBIDDEN");
  });
});
