import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  META_AD_ACCOUNT_GET_TOOL,
  META_AD_ACCOUNT_LIST_TOOL,
  META_AD_LIST_TOOL,
  META_AD_SET_LIST_TOOL,
  META_CAMPAIGN_LIST_TOOL,
  META_INSIGHTS_ACCOUNT_TOOL,
  META_INSIGHTS_AD_SET_TOOL,
  META_INSIGHTS_AD_TOOL,
  META_INSIGHTS_BREAKDOWN_TOOL,
  META_INSIGHTS_CAMPAIGN_TOOL,
} from "../src/constants.js";
import { createMetaAdsConnector } from "../src/connector.js";
import { mapMetaError } from "../src/map-meta-error.js";
import {
  FAKE_META_ADS_ACCESS_TOKEN,
  MOCK_ACCOUNT_ID,
  startMockMetaAdsHttpServer,
  type MockMetaAdsHttpServer,
} from "./fixtures/mock-meta-ads-http-server.js";
import { createTestMetaGraphClient } from "./helpers/test-env.js";

describe("Meta Ads connector (fake provider)", () => {
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

  async function callTool(
    tool: string,
    args: Record<string, unknown>,
    connectorOptions?: { allowedAccountIds?: string[]; maxRows?: number },
  ) {
    server = await startMockMetaAdsHttpServer();
    const client = createTestMetaGraphClient(server);
    const connector = createMetaAdsConnector({
      client,
      accessTokenForRedaction: FAKE_META_ADS_ACCESS_TOKEN,
      ...(connectorOptions?.allowedAccountIds !== undefined
        ? { allowedAccountIds: connectorOptions.allowedAccountIds }
        : {}),
      ...(connectorOptions?.maxRows !== undefined
        ? { maxRows: connectorOptions.maxRows }
        : {}),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient.callTool({ name: tool, arguments: args });
  }

  it("covers all ten tools", async () => {
    const range = { startDate: "2024-01-01", endDate: "2024-01-07" };
    const calls: Array<[string, Record<string, unknown>]> = [
      [META_AD_ACCOUNT_LIST_TOOL, { limit: 10 }],
      [META_AD_ACCOUNT_GET_TOOL, { accountId: MOCK_ACCOUNT_ID }],
      [META_CAMPAIGN_LIST_TOOL, { accountId: MOCK_ACCOUNT_ID, limit: 5 }],
      [
        META_AD_SET_LIST_TOOL,
        { accountId: MOCK_ACCOUNT_ID, campaignId: "9001", limit: 5 },
      ],
      [META_AD_LIST_TOOL, { accountId: MOCK_ACCOUNT_ID, limit: 5 }],
      [
        META_INSIGHTS_ACCOUNT_TOOL,
        { accountId: MOCK_ACCOUNT_ID, ...range, limit: 5 },
      ],
      [
        META_INSIGHTS_CAMPAIGN_TOOL,
        { accountId: MOCK_ACCOUNT_ID, ...range, limit: 5 },
      ],
      [
        META_INSIGHTS_AD_SET_TOOL,
        { accountId: MOCK_ACCOUNT_ID, ...range, limit: 5 },
      ],
      [
        META_INSIGHTS_AD_TOOL,
        { accountId: MOCK_ACCOUNT_ID, ...range, limit: 5 },
      ],
      [
        META_INSIGHTS_BREAKDOWN_TOOL,
        {
          accountId: MOCK_ACCOUNT_ID,
          ...range,
          breakdowns: ["age"],
          limit: 5,
        },
      ],
    ];
    for (const [tool, args] of calls) {
      const result = await callTool(tool, args);
      expect(result.isError).not.toBe(true);
    }
  });

  it("enforces account allowlist", async () => {
    const result = await callTool(
      META_AD_ACCOUNT_GET_TOOL,
      { accountId: MOCK_ACCOUNT_ID },
      { allowedAccountIds: ["act_999"] },
    );
    expect(result.isError).toBe(true);
  });

  it("maps provider unauthorized errors", () => {
    const mapped = mapMetaError(
      { kind: "http", status: 401, metaCode: 190 },
      { accessToken: FAKE_META_ADS_ACCESS_TOKEN },
    );
    expect(mapped.code).toBe("UNAUTHORIZED");
  });
});
