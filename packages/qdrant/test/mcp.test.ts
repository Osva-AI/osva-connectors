import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  QDRANT_COLLECTION_GET_TOOL,
  QDRANT_COLLECTION_LIST_TOOL,
  QDRANT_POINT_COUNT_TOOL,
  QDRANT_POINT_GET_TOOL,
  QDRANT_POINT_QUERY_TOOL,
  QDRANT_POINT_SCROLL_TOOL,
  QDRANT_POINT_UPSERT_TOOL,
} from "../src/constants.js";
import { createQdrantConnector } from "../src/connector.js";
import {
  startMockQdrantHttpServer,
  type MockQdrantHttpServer,
} from "./fixtures/mock-qdrant-http-server.js";
import {
  createTestQdrantClient,
  defaultTestQdrantConfig,
  FAKE_QDRANT_API_KEY,
} from "./helpers/test-env.js";

describe("MCP compatibility (qdrant)", () => {
  const clients: Client[] = [];
  let server: MockQdrantHttpServer | undefined;

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
    server = await startMockQdrantHttpServer();
    const client = createTestQdrantClient(server);
    const config = {
      ...defaultTestQdrantConfig(),
      baseUrl: server.baseUrl,
    };
    const connector = createQdrantConnector({
      client,
      config,
      apiKeyForRedaction: FAKE_QDRANT_API_KEY,
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
    expect(names).toEqual([
      QDRANT_COLLECTION_LIST_TOOL,
      QDRANT_COLLECTION_GET_TOOL,
      QDRANT_POINT_GET_TOOL,
      QDRANT_POINT_SCROLL_TOOL,
      QDRANT_POINT_QUERY_TOOL,
      QDRANT_POINT_COUNT_TOOL,
      QDRANT_POINT_UPSERT_TOOL,
    ]);

    const listed = await mcpClient.callTool({
      name: QDRANT_COLLECTION_LIST_TOOL,
      arguments: {},
    });
    expect(listed.isError).not.toBe(true);
  });
});
