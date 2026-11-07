import { describe, expect, it, afterEach } from "vitest";

import {
  startMockTavilyHttpServer,
  type MockTavilyHttpServer,
} from "./fixtures/mock-tavily-http-server.js";
import {
  createTestTavilyClient,
  FAKE_TAVILY_API_KEY,
} from "./helpers/test-env.js";

describe("Tavily REST client", () => {
  let server: MockTavilyHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends Bearer authorization and include_usage", async () => {
    server = await startMockTavilyHttpServer();
    const client = createTestTavilyClient(server);
    await client.search({ query: "fixture query" });
    expect(server.getLastAuthorization()).toBe(`Bearer ${FAKE_TAVILY_API_KEY}`);
    expect(server.getLastPathname()).toBe("/search");
    expect(server.getLastBody()?.include_usage).toBe(true);
    expect(server.getLastBody()?.query).toBe("fixture query");
  });

  it("posts crawl limits to the provider", async () => {
    server = await startMockTavilyHttpServer();
    const client = createTestTavilyClient(server);
    await client.crawl({
      url: "https://example.com/",
      maxDepth: 2,
      limit: 5,
      maxBreadth: 10,
    });
    expect(server.getLastPathname()).toBe("/crawl");
    expect(server.getLastBody()?.max_depth).toBe(2);
    expect(server.getLastBody()?.limit).toBe(5);
    expect(server.getLastBody()?.max_breadth).toBe(10);
  });
});
