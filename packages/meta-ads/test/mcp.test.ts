import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  META_AD_ACCOUNT_LIST_TOOL,
  META_INSIGHTS_ACCOUNT_TOOL,
} from "../src/constants.js";
import { createMetaAdsConnector } from "../src/connector.js";
import {
  FAKE_META_ADS_ACCESS_TOKEN,
  MOCK_ACCOUNT_ID,
  startMockMetaAdsHttpServer,
  type MockMetaAdsHttpServer,
} from "./fixtures/mock-meta-ads-http-server.js";
import { createTestMetaGraphClient } from "./helpers/test-env.js";

const EXPECTED_TOOL_COUNT = 10;

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockMetaAdsHttpServer | undefined;

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
    server = await startMockMetaAdsHttpServer();
    const client = createTestMetaGraphClient(server);
    const connector = createMetaAdsConnector({
      client,
      accessTokenForRedaction: FAKE_META_ADS_ACCESS_TOKEN,
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
        META_AD_ACCOUNT_LIST_TOOL,
        META_INSIGHTS_ACCOUNT_TOOL,
      ]),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(EXPECTED_TOOL_COUNT);

    const result = await mcpClient.callTool({
      name: META_AD_ACCOUNT_LIST_TOOL,
      arguments: { limit: 5 },
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result)).not.toContain(FAKE_META_ADS_ACCESS_TOKEN);
  });

  it("returns INVALID_INPUT for malformed insights input", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: META_INSIGHTS_ACCOUNT_TOOL,
      arguments: {
        accountId: MOCK_ACCOUNT_ID,
        startDate: "2024-13-40",
        endDate: "2024-01-07",
      },
    });
    expect(result.isError).toBe(true);
  });
});
