import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { createPipedriveConnector } from "../src/connector.js";
import {
  startMockPipedriveHttpServer,
  type MockPipedriveHttpServer,
} from "./fixtures/mock-pipedrive-http-server.js";
import {
  createTestPipedriveClient,
  createTestPipedriveConfig,
} from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  "pipedrive.pipeline.list",
  "pipedrive.stage.list",
  "pipedrive.deal.list",
  "pipedrive.deal.get",
  "pipedrive.deal.search",
  "pipedrive.person.list",
  "pipedrive.person.get",
  "pipedrive.organization.list",
  "pipedrive.organization.get",
  "pipedrive.deal.stage.set",
];

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockPipedriveHttpServer | undefined;
  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map((c) => c.close().catch(() => undefined)),
    );
    await server?.close();
    server = undefined;
  });
  it("exposes exactly ten tools", async () => {
    server = await startMockPipedriveHttpServer();
    const connector = createPipedriveConnector({
      client: createTestPipedriveClient(server),
      config: createTestPipedriveConfig({
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
