import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import {
  ConnectorSdkError,
  createMcpServerFromConnector,
} from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  KLAVIYO_REPORT_CAMPAIGN_TOOL,
  KLAVIYO_REPORT_FLOW_TOOL,
} from "../src/constants.js";
import { createKlaviyoConnector } from "../src/connector.js";
import { loadKlaviyoConfig } from "../src/config.js";
import {
  MOCK_CAMPAIGN_ID,
  MOCK_METRIC_ID,
  startMockKlaviyoHttpServer,
  type MockKlaviyoHttpServer,
  type MockKlaviyoMode,
} from "./fixtures/mock-klaviyo-http-server.js";
import {
  createTestKlaviyoClient,
  FAKE_KLAVIYO_PRIVATE_API_KEY,
} from "./helpers/test-env.js";

describe("security regression", () => {
  const clients: Client[] = [];
  let server: MockKlaviyoHttpServer | undefined;

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

  async function linkedClient(mode?: MockKlaviyoMode) {
    server = await startMockKlaviyoHttpServer(mode ? { mode } : {});
    const client = createTestKlaviyoClient(server);
    const connector = createKlaviyoConnector({
      client,
      privateApiKeyForRedaction: FAKE_KLAVIYO_PRIVATE_API_KEY,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "security-regression", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("rejects missing credentials at config load", () => {
    expect(() => loadKlaviyoConfig({})).toThrow(ConnectorSdkError);
  });

  it("rejects invalid max rows configuration", () => {
    expect(() =>
      loadKlaviyoConfig({
        OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY: "pk_test",
        OSVA_CONNECTOR_KLAVIYO_MAX_ROWS: "not-a-number",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("surfaces forbidden scope failures from provider", async () => {
    const { mcpClient } = await linkedClient("forbidden");
    const result = await mcpClient.callTool({
      name: KLAVIYO_REPORT_CAMPAIGN_TOOL,
      arguments: {
        statistics: ["opens"],
        timeframeKey: "last_7_days",
        conversionMetricId: MOCK_METRIC_ID,
      },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects unsupported raw-style report filter strings via MCP schema", async () => {
    const { mcpClient } = await linkedClient();
    const result = await mcpClient.callTool({
      name: KLAVIYO_REPORT_CAMPAIGN_TOOL,
      arguments: {
        statistics: ["opens"],
        timeframeKey: "last_7_days",
        conversionMetricId: MOCK_METRIC_ID,
        filter: 'equals(campaign_id,"injected")',
      },
    });
    expect(result.isError).toBe(true);
  });

  it("encodes structured campaign report filters for provider POST bodies", async () => {
    const { mcpClient, server } = await linkedClient();
    const result = await mcpClient.callTool({
      name: KLAVIYO_REPORT_CAMPAIGN_TOOL,
      arguments: {
        statistics: ["opens", "open_rate"],
        timeframeKey: "last_30_days",
        conversionMetricId: MOCK_METRIC_ID,
        filter: {
          sendChannels: ["email"],
          campaignId: MOCK_CAMPAIGN_ID,
        },
      },
    });
    expect(result.isError).not.toBe(true);
    const body = server.getLastCampaignReportBody() as {
      data?: { attributes?: { filter?: string } };
    };
    expect(body.data?.attributes?.filter).toBe(
      `and(contains-any(send_channel,["email"]),equals(campaign_id,"${MOCK_CAMPAIGN_ID}"))`,
    );
  });

  it("preserves flow reporting groupings and statistics from provider", async () => {
    const { mcpClient } = await linkedClient();
    const result = await mcpClient.callTool({
      name: KLAVIYO_REPORT_FLOW_TOOL,
      arguments: {
        statistics: ["opens", "open_rate"],
        timeframeKey: "last_7_days",
        conversionMetricId: MOCK_METRIC_ID,
        groupBy: ["flow_id", "send_channel"],
      },
    });
    expect(result.isError).not.toBe(true);
    const text = JSON.stringify(result);
    expect(text).toContain("send_channel");
    expect(text).toContain('"flow_id":"flow01"');
    expect(text).toContain('"opens":100');
    expect(text).toContain('"open_rate":0.25');
  });
});
