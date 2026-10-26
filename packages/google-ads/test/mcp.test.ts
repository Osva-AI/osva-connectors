import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  ADS_CAMPAIGN_PERFORMANCE_TOOL,
  ADS_CUSTOMER_LIST_TOOL,
} from "../src/constants.js";
import { createGoogleAdsConnector } from "../src/connector.js";
import {
  FAKE_GOOGLE_ADS_ACCESS_TOKEN,
  MOCK_CUSTOMER_ID,
  startMockGoogleAdsHttpServer,
  type MockGoogleAdsHttpServer,
} from "./fixtures/mock-google-ads-http-server.js";
import { createTestGoogleAdsClient } from "./helpers/test-env.js";

const EXPECTED_TOOL_COUNT = 9;

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockGoogleAdsHttpServer | undefined;

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
    server = await startMockGoogleAdsHttpServer();
    const client = createTestGoogleAdsClient(server);
    const connector = createGoogleAdsConnector({
      client,
      accessTokenForRedaction: FAKE_GOOGLE_ADS_ACCESS_TOKEN,
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
      expect.arrayContaining([
        ADS_CUSTOMER_LIST_TOOL,
        ADS_CAMPAIGN_PERFORMANCE_TOOL,
      ]),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(EXPECTED_TOOL_COUNT);

    const result = await mcpClient.callTool({
      name: ADS_CUSTOMER_LIST_TOOL,
      arguments: { limit: 5 },
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result)).not.toContain(FAKE_GOOGLE_ADS_ACCESS_TOKEN);
  });

  it("returns INVALID_INPUT for malformed performance input", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: ADS_CAMPAIGN_PERFORMANCE_TOOL,
      arguments: {
        customerId: MOCK_CUSTOMER_ID,
        startDate: "2024-01-01",
        endDate: "2024-01-02",
        currencyCode: "US",
      },
    });
    expect(result.isError).toBe(true);
  });
});
