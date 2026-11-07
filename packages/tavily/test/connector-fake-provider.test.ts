import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  TAVILY_CRAWL_TOOL,
  TAVILY_EXTRACT_TOOL,
  TAVILY_SEARCH_TOOL,
} from "../src/constants.js";
import { createTavilyConnector } from "../src/connector.js";
import { mapTavilyError } from "../src/map-tavily-error.js";
import {
  startMockTavilyHttpServer,
  type MockTavilyHttpServer,
} from "./fixtures/mock-tavily-http-server.js";
import { createTestTavilyClient } from "./helpers/test-env.js";

describe("Tavily connector (fake provider)", () => {
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
    return { mcpClient, client, server };
  }

  it("searches and returns provider usage", async () => {
    const { mcpClient } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: TAVILY_SEARCH_TOOL,
      arguments: { query: "who is Leo Messi?" },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content?.[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      const parsed = JSON.parse(text.text) as {
        providerUsage?: { credits?: number };
        untrustedContent?: boolean;
      };
      expect(parsed.providerUsage?.credits).toBe(1);
      expect(parsed.untrustedContent).toBe(true);
    }
  });

  it("extracts HTTPS URLs", async () => {
    const { mcpClient } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: TAVILY_EXTRACT_TOOL,
      arguments: { urls: ["https://example.com/article"] },
    });
    expect(result.isError).not.toBe(true);
  });

  it("crawl reports limitsApplied", async () => {
    const { mcpClient } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: TAVILY_CRAWL_TOOL,
      arguments: { url: "https://example.com/", maxDepth: 2, limit: 5 },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content?.[0];
    if (text?.type === "text") {
      const parsed = JSON.parse(text.text) as {
        limitsApplied?: { maxDepth: number };
      };
      expect(parsed.limitsApplied?.maxDepth).toBe(2);
    }
  });

  it("maps unauthorized provider responses", async () => {
    server = await startMockTavilyHttpServer();
    server.setMode("unauthorized");
    const client = createTestTavilyClient(server);
    const connector = createTavilyConnector({ client });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: TAVILY_SEARCH_TOOL,
      arguments: { query: "test" },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects private extract targets at validation", async () => {
    const { mcpClient } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: TAVILY_EXTRACT_TOOL,
      arguments: { urls: ["https://127.0.0.1/secret"] },
    });
    expect(result.isError).toBe(true);
  });

  it("connector error mapper exposes SDK codes", () => {
    const error = mapTavilyError({
      kind: "http",
      status: 429,
      detail: { error: "Rate limited" },
    });
    expect(error).toBeInstanceOf(ConnectorSdkError);
    expect(error.code).toBe("RATE_LIMITED");
  });
});
