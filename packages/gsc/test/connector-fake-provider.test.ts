import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GSC_PERFORMANCE_PAGES_TOOL,
  GSC_PERFORMANCE_QUERIES_TOOL,
  GSC_PERFORMANCE_QUERY_TOOL,
  GSC_PROPERTY_GET_TOOL,
  GSC_PROPERTY_LIST_TOOL,
  GSC_SITEMAP_GET_TOOL,
  GSC_SITEMAP_LIST_TOOL,
  GSC_URL_INSPECT_TOOL,
} from "../src/constants.js";
import { createGscConnector } from "../src/connector.js";
import { mapGscError } from "../src/map-gsc-error.js";
import {
  MOCK_SITE_URL,
  startMockGscHttpServer,
  type MockGscHttpServer,
} from "./fixtures/mock-gsc-http-server.js";
import {
  createTestGscClient,
  FAKE_GSC_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("GSC connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockGscHttpServer | undefined;

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

  async function createLinkedClient(
    mode?: import("./fixtures/mock-gsc-http-server.js").MockGscMode,
  ) {
    server = await startMockGscHttpServer(mode ? { mode } : {});
    const client = createTestGscClient(server);
    const connector = createGscConnector({
      client,
      defaultSiteUrl: MOCK_SITE_URL,
      accessTokenForRedaction: FAKE_GSC_ACCESS_TOKEN,
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
    return mcpClient;
  }

  async function callTool(
    mcpClient: Client,
    name: string,
    arguments_: Record<string, unknown>,
  ) {
    return mcpClient.callTool({ name, arguments: arguments_ });
  }

  it("exercises all eight tools against the fake provider", async () => {
    const mcpClient = await createLinkedClient();

    const listed = await callTool(mcpClient, GSC_PROPERTY_LIST_TOOL, {});
    expect(listed.isError).not.toBe(true);

    const got = await callTool(mcpClient, GSC_PROPERTY_GET_TOOL, {});
    expect(got.isError).not.toBe(true);

    const query = await callTool(mcpClient, GSC_PERFORMANCE_QUERY_TOOL, {
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      dimensions: ["query"],
      rowLimit: 10,
    });
    expect(query.isError).not.toBe(true);

    const pages = await callTool(mcpClient, GSC_PERFORMANCE_PAGES_TOOL, {
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      limit: 5,
    });
    expect(pages.isError).not.toBe(true);

    const queries = await callTool(mcpClient, GSC_PERFORMANCE_QUERIES_TOOL, {
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      limit: 5,
    });
    expect(queries.isError).not.toBe(true);

    const sitemaps = await callTool(mcpClient, GSC_SITEMAP_LIST_TOOL, {});
    expect(sitemaps.isError).not.toBe(true);

    const sitemap = await callTool(mcpClient, GSC_SITEMAP_GET_TOOL, {
      sitemapUrl: "https://example.com/sitemap.xml",
    });
    expect(sitemap.isError).not.toBe(true);

    const inspect = await callTool(mcpClient, GSC_URL_INSPECT_TOOL, {
      inspectionUrl: "https://example.com/page",
    });
    expect(inspect.isError).not.toBe(true);
  });

  it("maps forbidden provider errors", async () => {
    const mapped = mapGscError(
      { kind: "http", status: 403, googleStatus: "PERMISSION_DENIED" },
      { accessToken: FAKE_GSC_ACCESS_TOKEN },
    );
    expect(mapped.code).toBe("FORBIDDEN");
  });

  it("returns MCP errors for invalid input", async () => {
    const mcpClient = await createLinkedClient();
    const invalid = await callTool(mcpClient, GSC_PERFORMANCE_QUERY_TOOL, {
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      dimensions: ["not-a-dimension"],
    });
    expect(invalid.isError).toBe(true);
  });
});
