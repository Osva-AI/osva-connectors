import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  TAVILY_CRAWL_TOOL,
  TAVILY_EXTRACT_TOOL,
  TAVILY_SEARCH_TOOL,
} from "../src/constants.js";
import { createTavilyConnector } from "../src/connector.js";
import {
  startMockTavilyHttpServer,
  type MockTavilyHttpServer,
} from "./fixtures/mock-tavily-http-server.js";
import { createTestTavilyClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockTavilyHttpServer | undefined;

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
    server = await startMockTavilyHttpServer();
    const client = createTestTavilyClient(server);
    const connector = createTavilyConnector({ client });
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
        TAVILY_SEARCH_TOOL,
        TAVILY_EXTRACT_TOOL,
        TAVILY_CRAWL_TOOL,
      ]),
    );
    expect(names.length).toBe(3);

    const result = await mcpClient.callTool({
      name: TAVILY_SEARCH_TOOL,
      arguments: { query: "fixture" },
    });
    expect(result.isError).not.toBe(true);
  });
});
