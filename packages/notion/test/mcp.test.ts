import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { NOTION_PAGE_GET_TOOL, NOTION_SEARCH_TOOL } from "../src/constants.js";
import { createNotionConnector } from "../src/connector.js";
import { notionConfigSchema } from "../src/schemas.js";
import {
  startMockNotionHttpServer,
  MOCK_PAGE_ID,
  type MockNotionHttpServer,
} from "./fixtures/mock-notion-http-server.js";
import { createTestNotionClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockNotionHttpServer | undefined;

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
    server = await startMockNotionHttpServer();
    const client = createTestNotionClient(server);
    const config = notionConfigSchema.parse({
      accessToken: "ntn_fixture",
      apiVersion: "2026-03-11",
      writeEnabled: false,
      hostWritesApproved: false,
    });
    const connector = createNotionConnector({ client, config });
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
      expect.arrayContaining([NOTION_SEARCH_TOOL, NOTION_PAGE_GET_TOOL]),
    );
    expect(names.length).toBe(9);

    const result = await mcpClient.callTool({
      name: NOTION_PAGE_GET_TOOL,
      arguments: { pageId: MOCK_PAGE_ID },
    });
    expect(result.isError).not.toBe(true);
  });
});
