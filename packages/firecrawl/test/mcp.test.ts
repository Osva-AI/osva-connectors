import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  FIRECRAWL_SCRAPE_TOOL,
  FIRECRAWL_SEARCH_TOOL,
} from "../src/constants.js";
import { createFirecrawlConnector } from "../src/connector.js";
import { firecrawlConfigSchema } from "../src/schemas.js";
import {
  startMockFirecrawlHttpServer,
  type MockFirecrawlHttpServer,
} from "./fixtures/mock-firecrawl-http-server.js";
import {
  createTestFirecrawlClient,
  FAKE_FIRECRAWL_API_KEY,
} from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockFirecrawlHttpServer | undefined;

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
    server = await startMockFirecrawlHttpServer();
    const client = createTestFirecrawlClient(server);
    const config = firecrawlConfigSchema.parse({
      apiKey: FAKE_FIRECRAWL_API_KEY,
      requestTimeoutMs: 5_000,
    });
    const connector = createFirecrawlConnector({
      client,
      config,
      apiHost: server.apiOrigin,
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
      expect.arrayContaining([FIRECRAWL_SCRAPE_TOOL, FIRECRAWL_SEARCH_TOOL]),
    );
    expect(names.length).toBe(5);

    const result = await mcpClient.callTool({
      name: FIRECRAWL_SCRAPE_TOOL,
      arguments: { url: "https://example.com" },
    });
    expect(result.isError).not.toBe(true);
  });
});
