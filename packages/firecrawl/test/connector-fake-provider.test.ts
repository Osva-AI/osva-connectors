import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  FIRECRAWL_CRAWL_START_TOOL,
  FIRECRAWL_CRAWL_STATUS_TOOL,
  FIRECRAWL_MAP_TOOL,
  FIRECRAWL_SCRAPE_TOOL,
  FIRECRAWL_SEARCH_TOOL,
} from "../src/constants.js";
import { createFirecrawlConnector } from "../src/connector.js";
import {
  MOCK_CRAWL_ID,
  startMockFirecrawlHttpServer,
  type MockFirecrawlHttpServer,
} from "./fixtures/mock-firecrawl-http-server.js";
import { createTestFirecrawlClient } from "./helpers/test-env.js";
import { firecrawlConfigSchema } from "../src/schemas.js";
import { FAKE_FIRECRAWL_API_KEY } from "./helpers/test-env.js";

describe("Firecrawl connector (fake HTTP provider)", () => {
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
      apiKeyForRedaction: FAKE_FIRECRAWL_API_KEY,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({
      name: "fake-provider-test",
      version: "1.0",
    });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  async function callTool(
    mcpClient: Client,
    name: string,
    arguments_: Record<string, unknown>,
  ) {
    return mcpClient.callTool({ name, arguments: arguments_ });
  }

  function parseStructuredResult(result: {
    content: Array<{ type: string; text?: string }>;
  }): Record<string, unknown> {
    const textPart = result.content.find((part) => part.type === "text");
    expect(textPart?.text).toBeDefined();
    return JSON.parse(textPart!.text!) as Record<string, unknown>;
  }

  it("exercises all five tools against the fake provider", async () => {
    const { mcpClient } = await createLinkedClient();

    const scrape = await callTool(mcpClient, FIRECRAWL_SCRAPE_TOOL, {
      url: "https://example.com",
    });
    expect(scrape.isError).not.toBe(true);

    const search = await callTool(mcpClient, FIRECRAWL_SEARCH_TOOL, {
      query: "fixture query",
      limit: 5,
    });
    expect(search.isError).not.toBe(true);

    const map = await callTool(mcpClient, FIRECRAWL_MAP_TOOL, {
      url: "https://example.com",
      limit: 10,
    });
    expect(map.isError).not.toBe(true);

    const started = await callTool(mcpClient, FIRECRAWL_CRAWL_START_TOOL, {
      url: "https://example.com",
      limit: 3,
    });
    expect(started.isError).not.toBe(true);
    const startedBody = parseStructuredResult(
      started as { content: Array<{ type: string; text?: string }> },
    );
    expect(startedBody.crawlId).toBe(MOCK_CRAWL_ID);

    const status = await callTool(mcpClient, FIRECRAWL_CRAWL_STATUS_TOOL, {
      crawlId: MOCK_CRAWL_ID,
    });
    expect(status.isError).not.toBe(true);
  });

  it("paginates crawl status via next URLs", async () => {
    const { mcpClient, server } = await createLinkedClient();

    await callTool(mcpClient, FIRECRAWL_CRAWL_START_TOOL, {
      url: "https://example.com",
      limit: 3,
    });

    const pageOne = await callTool(mcpClient, FIRECRAWL_CRAWL_STATUS_TOOL, {
      crawlId: MOCK_CRAWL_ID,
    });
    expect(pageOne.isError).not.toBe(true);
    const pageOneBody = parseStructuredResult(
      pageOne as { content: Array<{ type: string; text?: string }> },
    );
    expect(pageOneBody.status).toBe("scraping");
    expect(pageOneBody.next).toBeDefined();
    const dataOne = pageOneBody.data as unknown[];
    expect(dataOne).toHaveLength(1);

    const pageTwo = await callTool(mcpClient, FIRECRAWL_CRAWL_STATUS_TOOL, {
      crawlId: MOCK_CRAWL_ID,
      next: pageOneBody.next,
    });
    expect(pageTwo.isError).not.toBe(true);
    const pageTwoBody = parseStructuredResult(
      pageTwo as { content: Array<{ type: string; text?: string }> },
    );
    expect(pageTwoBody.status).toBe("scraping");
    expect(pageTwoBody.creditsUsed).toBe(5);

    const pageThree = await callTool(mcpClient, FIRECRAWL_CRAWL_STATUS_TOOL, {
      crawlId: MOCK_CRAWL_ID,
      next: pageTwoBody.next,
    });
    const pageThreeBody = parseStructuredResult(
      pageThree as { content: Array<{ type: string; text?: string }> },
    );
    expect(pageThreeBody.status).toBe("completed");
    expect(pageThreeBody.next).toBeUndefined();
    expect(server?.getRequestCount()).toBeGreaterThan(3);
  });
});
