import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GA4_PROPERTY_LIST_TOOL,
  GA4_REPORT_RUN_TOOL,
} from "../src/constants.js";
import { createGa4Connector } from "../src/connector.js";
import {
  FAKE_GA4_ACCESS_TOKEN,
  MOCK_PROPERTY_ID,
  startMockGa4HttpServer,
  type MockGa4HttpServer,
} from "./fixtures/mock-ga4-http-server.js";
import { createTestGa4Client } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockGa4HttpServer | undefined;

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
    server = await startMockGa4HttpServer();
    const client = createTestGa4Client(server);
    const connector = createGa4Connector({
      client,
      defaultPropertyId: MOCK_PROPERTY_ID,
      accessTokenForRedaction: FAKE_GA4_ACCESS_TOKEN,
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
      expect.arrayContaining([GA4_PROPERTY_LIST_TOOL, GA4_REPORT_RUN_TOOL]),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(7);

    const result = await mcpClient.callTool({
      name: GA4_PROPERTY_LIST_TOOL,
      arguments: { limit: 5 },
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result)).not.toContain(FAKE_GA4_ACCESS_TOKEN);
  });

  it("returns INVALID_INPUT for malformed report input", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: GA4_REPORT_RUN_TOOL,
      arguments: {
        startDate: "2024-01-01",
        endDate: "2024-01-02",
        metrics: ["bad metric name"],
      },
    });
    expect(result.isError).toBe(true);
  });
});
