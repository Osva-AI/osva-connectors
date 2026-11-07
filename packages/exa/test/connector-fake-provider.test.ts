import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  EXA_ANSWER_TOOL,
  EXA_CONTENTS_GET_TOOL,
  EXA_SEARCH_TOOL,
} from "../src/constants.js";
import { createExaConnector } from "../src/connector.js";
import {
  startMockExaHttpServer,
  type MockExaHttpServer,
} from "./fixtures/mock-exa-http-server.js";
import { createTestExaClient, FAKE_EXA_API_KEY } from "./helpers/test-env.js";

describe("Exa connector (fake provider)", () => {
  const clients: Client[] = [];
  let server: MockExaHttpServer | undefined;

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
    server = await startMockExaHttpServer();
    const client = createTestExaClient(server);
    const connector = createExaConnector({
      client,
      apiKeyForRedaction: FAKE_EXA_API_KEY,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("sends x-api-key on search", async () => {
    const { mcpClient, server: mock } = await createLinkedClient();
    await mcpClient.callTool({
      name: EXA_SEARCH_TOOL,
      arguments: { query: "neural search" },
    });
    expect(mock.getLastApiKey()).toBe(FAKE_EXA_API_KEY);
    expect(mock.getLastPathname()).toBe("/search");
  });

  it("returns contents for validated URLs", async () => {
    const { mcpClient } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: EXA_CONTENTS_GET_TOOL,
      arguments: { urls: ["https://example.com/page"] },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content?.[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      const parsed = JSON.parse(text.text) as { untrustedContent: boolean };
      expect(parsed.untrustedContent).toBe(true);
    }
  });

  it("rejects SSRF URLs at validation", async () => {
    const { mcpClient } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: EXA_CONTENTS_GET_TOOL,
      arguments: { urls: ["https://127.0.0.1/internal"] },
    });
    expect(result.isError).toBe(true);
  });

  it("returns answer disclaimer", async () => {
    const { mcpClient } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: EXA_ANSWER_TOOL,
      arguments: { query: "What is fixture?" },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content?.[0];
    if (text?.type === "text") {
      const parsed = JSON.parse(text.text) as {
        answerDisclaimer: string;
      };
      expect(parsed.answerDisclaimer).toContain(
        "not been independently verified",
      );
    }
  });

  it("maps unauthorized provider responses", async () => {
    server = await startMockExaHttpServer();
    server.setMode("unauthorized");
    const client = createTestExaClient(server);
    const connector = createExaConnector({ client });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: EXA_SEARCH_TOOL,
      arguments: { query: "test" },
    });
    expect(result.isError).toBe(true);
  });
});
