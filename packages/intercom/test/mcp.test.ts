import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { createIntercomConnector } from "../src/connector.js";
import {
  startMockIntercomHttpServer,
  type MockIntercomHttpServer,
} from "./fixtures/mock-intercom-http-server.js";
import {
  createTestIntercomClient,
  createTestIntercomConfig,
} from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  "intercom.conversation.list",
  "intercom.conversation.get",
  "intercom.conversation.search",
  "intercom.contact.list",
  "intercom.contact.get",
  "intercom.contact.search",
  "intercom.admin.list",
  "intercom.conversation.note.add",
  "intercom.conversation.state.set",
];

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockIntercomHttpServer | undefined;
  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map((c) => c.close().catch(() => undefined)),
    );
    await server?.close();
    server = undefined;
  });
  it("exposes exactly nine tools", async () => {
    server = await startMockIntercomHttpServer();
    const connector = createIntercomConnector({
      client: createTestIntercomClient(server),
      config: createTestIntercomConfig({
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
