import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  ADS_AD_GROUP_PERFORMANCE_TOOL,
  ADS_ASSET_PERFORMANCE_TOOL,
  ADS_CAMPAIGN_LIST_TOOL,
  ADS_CAMPAIGN_PERFORMANCE_TOOL,
  ADS_CUSTOMER_GET_TOOL,
  ADS_CUSTOMER_LIST_TOOL,
  ADS_KEYWORD_PERFORMANCE_TOOL,
  ADS_REPORT_QUERY_TOOL,
  ADS_SEARCH_TERM_PERFORMANCE_TOOL,
} from "../src/constants.js";
import { createGoogleAdsConnector } from "../src/connector.js";
import { mapGoogleAdsError } from "../src/map-google-ads-error.js";
import {
  FAKE_GOOGLE_ADS_ACCESS_TOKEN,
  MOCK_CUSTOMER_ID,
  startMockGoogleAdsHttpServer,
  type MockGoogleAdsHttpServer,
} from "./fixtures/mock-google-ads-http-server.js";
import { createTestGoogleAdsClient } from "./helpers/test-env.js";

describe("Google Ads connector (fake provider)", () => {
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

  async function callTool(
    tool: string,
    args: Record<string, unknown>,
    connectorOptions?: {
      allowedCustomerIds?: string[];
      maxRows?: number;
      loginCustomerId?: string;
      developerToken?: string;
    },
  ) {
    server = await startMockGoogleAdsHttpServer();
    const client = createTestGoogleAdsClient(server, {
      loginCustomerId: connectorOptions?.loginCustomerId,
      developerToken: connectorOptions?.developerToken,
    });
    const connector = createGoogleAdsConnector({
      client,
      accessTokenForRedaction: FAKE_GOOGLE_ADS_ACCESS_TOKEN,
      ...(connectorOptions?.allowedCustomerIds !== undefined
        ? { allowedCustomerIds: connectorOptions.allowedCustomerIds }
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

  it("covers all nine tools", async () => {
    const base = {
      customerId: MOCK_CUSTOMER_ID,
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      currencyCode: "USD",
    };
    const calls: Array<[string, Record<string, unknown>]> = [
      [ADS_CUSTOMER_LIST_TOOL, { limit: 10 }],
      [ADS_CUSTOMER_GET_TOOL, { customerId: MOCK_CUSTOMER_ID }],
      [ADS_CAMPAIGN_LIST_TOOL, { customerId: MOCK_CUSTOMER_ID, limit: 5 }],
      [
        ADS_CAMPAIGN_LIST_TOOL,
        {
          customerId: MOCK_CUSTOMER_ID,
          startDate: base.startDate,
          endDate: base.endDate,
          limit: 5,
        },
      ],
      [ADS_CAMPAIGN_PERFORMANCE_TOOL, { ...base, limit: 5 }],
      [ADS_AD_GROUP_PERFORMANCE_TOOL, { ...base, limit: 5 }],
      [ADS_KEYWORD_PERFORMANCE_TOOL, { ...base, limit: 5 }],
      [ADS_SEARCH_TERM_PERFORMANCE_TOOL, { ...base, limit: 5 }],
      [ADS_ASSET_PERFORMANCE_TOOL, { ...base, limit: 5 }],
      [
        ADS_REPORT_QUERY_TOOL,
        {
          ...base,
          resource: "campaign",
          attributes: ["campaign.id", "campaign.name"],
          metrics: ["metrics.impressions"],
          limit: 5,
        },
      ],
    ];
    for (const [tool, args] of calls) {
      const result = await callTool(tool, args);
      expect(result.isError).not.toBe(true);
    }
  });

  it("enforces customer allowlist", async () => {
    const result = await callTool(
      ADS_CUSTOMER_GET_TOOL,
      { customerId: MOCK_CUSTOMER_ID },
      { allowedCustomerIds: ["9999999999"] },
    );
    expect(result.isError).toBe(true);
  });

  it("sends login-customer-id and developer-token headers", async () => {
    await callTool(
      ADS_CUSTOMER_LIST_TOOL,
      { limit: 1 },
      {
        loginCustomerId: "9876543210",
        developerToken: "legacy-dev-token",
      },
    );
    expect(server?.getLastLoginCustomerId()).toBe("9876543210");
    expect(server?.getLastDeveloperToken()).toBe("legacy-dev-token");
  });

  it("maps quota and retryable errors", async () => {
    server = await startMockGoogleAdsHttpServer({ mode: "rate_limit_once" });
    const client = createTestGoogleAdsClient(server);
    const result = await client.listAccessibleCustomers({});
    expect(result).toBeTruthy();
    expect(server.getRequestCount()).toBeGreaterThanOrEqual(2);
  });

  it("redacts access tokens from mapped errors", () => {
    const mapped = mapGoogleAdsError(
      new Error(`Bearer ${FAKE_GOOGLE_ADS_ACCESS_TOKEN} leaked`),
      { accessToken: FAKE_GOOGLE_ADS_ACCESS_TOKEN },
    );
    expect(mapped.message).not.toContain(FAKE_GOOGLE_ADS_ACCESS_TOKEN);
  });
});
