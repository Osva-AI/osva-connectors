import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  QDRANT_COLLECTION_LIST_TOOL,
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

describe("Qdrant connector (fake provider)", () => {
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

  async function createLinkedClient(writeEnabled: boolean) {
    server = await startMockQdrantHttpServer();
    const client = createTestQdrantClient(server);
    const config = {
      ...defaultTestQdrantConfig(),
      baseUrl: server.baseUrl,
      writeEnabled,
      hostWritesApproved: writeEnabled,
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

  it("lists collections from mock Qdrant", async () => {
    const mcpClient = await createLinkedClient(false);
    const result = await mcpClient.callTool({
      name: QDRANT_COLLECTION_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
  });

  it("blocks upsert when writes disabled", async () => {
    const mcpClient = await createLinkedClient(false);
    const result = await mcpClient.callTool({
      name: QDRANT_POINT_UPSERT_TOOL,
      arguments: {
        collectionName: "docs",
        points: [{ id: 1, vector: [0.1, 0.2, 0.3] }],
      },
    });
    expect(result.isError).toBe(true);
  });
});
