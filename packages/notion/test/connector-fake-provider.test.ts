import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  NOTION_DATASOURCE_QUERY_TOOL,
  NOTION_PAGE_CREATE_TOOL,
  NOTION_SEARCH_TOOL,
} from "../src/constants.js";
import { createNotionConnector } from "../src/connector.js";
import { notionConfigSchema } from "../src/schemas.js";
import {
  MOCK_DATA_SOURCE_ID,
  MOCK_PAGE_ID,
  startMockNotionHttpServer,
  type MockNotionHttpServer,
} from "./fixtures/mock-notion-http-server.js";
import { createTestNotionClient } from "./helpers/test-env.js";

describe("Notion connector (fake provider)", () => {
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

  async function createLinkedClient(writeEnabled = false) {
    server = await startMockNotionHttpServer();
    const client = createTestNotionClient(server);
    const config = notionConfigSchema.parse({
      accessToken: "ntn_fixture",
      apiVersion: "2026-03-11",
      writeEnabled,
      hostWritesApproved: writeEnabled,
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

  it("searches with pagination envelope", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: NOTION_SEARCH_TOOL,
      arguments: { pageSize: 10 },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content?.[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      const parsed = JSON.parse(text.text) as { hasMore: boolean };
      expect(parsed.hasMore).toBe(false);
    }
  });

  it("queries data source by data source id", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: NOTION_DATASOURCE_QUERY_TOOL,
      arguments: { dataSourceId: MOCK_DATA_SOURCE_ID, pageSize: 5 },
    });
    expect(result.isError).not.toBe(true);
  });

  it("denies mutations when write flags are off", async () => {
    const mcpClient = await createLinkedClient(false);
    const result = await mcpClient.callTool({
      name: NOTION_PAGE_CREATE_TOOL,
      arguments: {
        parent: { type: "page_id", pageId: MOCK_PAGE_ID },
        properties: {},
      },
    });
    expect(result.isError).toBe(true);
  });

  it("maps unauthorized provider responses", async () => {
    server = await startMockNotionHttpServer();
    server.setMode("unauthorized");
    const client = createTestNotionClient(server);
    const config = notionConfigSchema.parse({
      accessToken: "ntn_fixture",
      apiVersion: "2026-03-11",
    });
    const connector = createNotionConnector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: NOTION_SEARCH_TOOL,
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });
});
