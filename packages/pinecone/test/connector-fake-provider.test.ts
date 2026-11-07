import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  PINECONE_VECTOR_LIST_TOOL,
  PINECONE_VECTOR_QUERY_TOOL,
  PINECONE_VECTOR_UPSERT_TOOL,
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

describe("Pinecone connector (fake provider)", () => {
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

  async function createLinkedClient(writeEnabled: boolean) {
    server = await startMockPineconeHttpServer();
    const client = createTestPineconeClient(server);
    const connector = createPineconeConnector({
      client,
      config: {
        ...defaultTestPineconeConfig(),
        writeEnabled,
        hostWritesApproved: writeEnabled,
      },
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

  it("queries dense index via resolved host", async () => {
    const mcpClient = await createLinkedClient(true);
    const result = await mcpClient.callTool({
      name: PINECONE_VECTOR_QUERY_TOOL,
      arguments: { indexName: "docs", vector: [0.1, 0.2, 0.3] },
    });
    expect(result.isError).not.toBe(true);
    expect(server?.getLastApiVersion()).toBe("2025-04");
  });

  it("rejects sparse index query", async () => {
    const mcpClient = await createLinkedClient(true);
    const result = await mcpClient.callTool({
      name: PINECONE_VECTOR_QUERY_TOOL,
      arguments: { indexName: "sparse-index", vector: [0.1] },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects vector list on pod-based index", async () => {
    const mcpClient = await createLinkedClient(true);
    const result = await mcpClient.callTool({
      name: PINECONE_VECTOR_LIST_TOOL,
      arguments: { indexName: "pod-index" },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects query dimension mismatch before data plane", async () => {
    const mcpClient = await createLinkedClient(true);
    const result = await mcpClient.callTool({
      name: PINECONE_VECTOR_QUERY_TOOL,
      arguments: { indexName: "docs", vector: [0.1, 0.2, 0.3, 0.4] },
    });
    expect(result.isError).toBe(true);
    expect(server?.getLastPathname()).not.toBe("/query");
  });

  it("blocks upsert without write approval", async () => {
    const mcpClient = await createLinkedClient(false);
    const result = await mcpClient.callTool({
      name: PINECONE_VECTOR_UPSERT_TOOL,
      arguments: {
        indexName: "docs",
        vectors: [{ id: "v1", values: [0.1, 0.2, 0.3] }],
      },
    });
    expect(result.isError).toBe(true);
  });
});
