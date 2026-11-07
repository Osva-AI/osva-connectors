import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  PINECONE_INDEX_LIST_TOOL,
  PINECONE_VECTOR_QUERY_TOOL,
} from "../src/constants.js";
import { createPineconeConnector } from "../src/connector.js";
import {
  startMockPineconeHttpServer,
  type MockPineconeHttpServer,
} from "./fixtures/mock-pinecone-http-server.js";
import {
  createTestPineconeClient,
  defaultTestPineconeConfig,
  FAKE_PINECONE_API_KEY,
} from "./helpers/test-env.js";

describe("MCP compatibility (pinecone)", () => {
  const clients: Client[] = [];
  let server: MockPineconeHttpServer | undefined;

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
    server = await startMockPineconeHttpServer();
    const client = createTestPineconeClient(server);
    const connector = createPineconeConnector({
      client,
      config: defaultTestPineconeConfig(),
      apiKeyForRedaction: FAKE_PINECONE_API_KEY,
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

  it("supports tools/list and query call", async () => {
    const mcpClient = await createLinkedClient();
    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toContain(PINECONE_INDEX_LIST_TOOL);
    expect(names).toContain(PINECONE_VECTOR_QUERY_TOOL);

    const listed = await mcpClient.callTool({
      name: PINECONE_INDEX_LIST_TOOL,
      arguments: {},
    });
    expect(listed.isError).not.toBe(true);

    const query = await mcpClient.callTool({
      name: PINECONE_VECTOR_QUERY_TOOL,
      arguments: { indexName: "docs", vector: [0.1, 0.2, 0.3] },
    });
    expect(query.isError).not.toBe(true);
  });
});
