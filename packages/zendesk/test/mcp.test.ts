import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { createZendeskConnector } from "../src/connector.js";
import {
  startMockZendeskHttpServer,
  type MockZendeskHttpServer,
} from "./fixtures/mock-zendesk-http-server.js";
import {
  createTestZendeskClient,
  createTestZendeskConfig,
} from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  "zendesk.ticket.list",
  "zendesk.ticket.get",
  "zendesk.ticket.search",
  "zendesk.ticket.comment.list",
  "zendesk.user.get",
  "zendesk.ticket.note.add",
  "zendesk.ticket.status.set",
];

describe("MCP compatibility", () => {
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

  async function createLinkedClient() {
    server = await startMockZendeskHttpServer();
    const client = createTestZendeskClient(server);
    const connector = createZendeskConnector({
      client,
      config: createTestZendeskConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "zendesk-test", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("exposes exactly seven tools", async () => {
    const mcpClient = await createLinkedClient();
    const listed = await mcpClient.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
