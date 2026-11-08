import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { createFreshdeskConnector } from "../src/connector.js";
import {
  startMockFreshdeskHttpServer,
  type MockFreshdeskHttpServer,
} from "./fixtures/mock-freshdesk-http-server.js";
import {
  createTestFreshdeskClient,
  createTestFreshdeskConfig,
} from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  "freshdesk.ticket.list",
  "freshdesk.ticket.get",
  "freshdesk.ticket.search",
  "freshdesk.ticket.conversation.list",
  "freshdesk.contact.list",
  "freshdesk.contact.get",
  "freshdesk.ticket.note.add",
  "freshdesk.ticket.status.set",
];

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockFreshdeskHttpServer | undefined;
  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map((c) => c.close().catch(() => undefined)),
    );
    await server?.close();
    server = undefined;
  });
  it("exposes exactly eight tools", async () => {
    server = await startMockFreshdeskHttpServer();
    const connector = createFreshdeskConnector({
      client: createTestFreshdeskClient(server),
      config: createTestFreshdeskConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "t", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(st);
    await mcpClient.connect(ct);
    const names = (await mcpClient.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
