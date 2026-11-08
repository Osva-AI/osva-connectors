import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { createZohoConnector } from "../src/connector.js";
import {
  startMockZohoHttpServer,
  type MockZohoHttpServer,
} from "./fixtures/mock-zoho-http-server.js";
import {
  createTestZohoClient,
  createTestZohoConfig,
} from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  "zoho.lead.list",
  "zoho.lead.get",
  "zoho.account.list",
  "zoho.account.get",
  "zoho.contact.list",
  "zoho.contact.get",
  "zoho.deal.list",
  "zoho.deal.get",
  "zoho.deal.stage.list",
  "zoho.deal.stage.set",
  "zoho.deal.note.add",
];

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockZohoHttpServer | undefined;
  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map((c) => c.close().catch(() => undefined)),
    );
    await server?.close();
    server = undefined;
  });
  it("exposes exactly eleven tools", async () => {
    server = await startMockZohoHttpServer();
    const connector = createZohoConnector({
      client: createTestZohoClient(server),
      config: createTestZohoConfig({
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
