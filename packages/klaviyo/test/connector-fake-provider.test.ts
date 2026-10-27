import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  KLAVIYO_ACCOUNT_GET_TOOL,
  KLAVIYO_CAMPAIGN_GET_TOOL,
  KLAVIYO_CAMPAIGN_LIST_TOOL,
  KLAVIYO_EVENT_LIST_TOOL,
  KLAVIYO_FLOW_GET_TOOL,
  KLAVIYO_FLOW_LIST_TOOL,
  KLAVIYO_METRIC_GET_TOOL,
  KLAVIYO_METRIC_LIST_TOOL,
  KLAVIYO_REPORT_CAMPAIGN_TOOL,
  KLAVIYO_REPORT_FLOW_TOOL,
} from "../src/constants.js";
import { createKlaviyoConnector } from "../src/connector.js";
import { mapKlaviyoError } from "../src/map-klaviyo-error.js";
import {
  MOCK_CAMPAIGN_ID,
  MOCK_FLOW_ID,
  MOCK_METRIC_ID,
  startMockKlaviyoHttpServer,
  type MockKlaviyoHttpServer,
} from "./fixtures/mock-klaviyo-http-server.js";
import {
  createTestKlaviyoClient,
  FAKE_KLAVIYO_PRIVATE_API_KEY,
} from "./helpers/test-env.js";

describe("Klaviyo connector (fake HTTP provider)", () => {
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

  async function createLinkedClient(
    mode?: import("./fixtures/mock-klaviyo-http-server.js").MockKlaviyoMode,
  ) {
    server = await startMockKlaviyoHttpServer(mode ? { mode } : {});
    const client = createTestKlaviyoClient(server);
    const connector = createKlaviyoConnector({
      client,
      privateApiKeyForRedaction: FAKE_KLAVIYO_PRIVATE_API_KEY,
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

  it("exercises all ten tools against the fake provider", async () => {
    const { mcpClient, server } = await createLinkedClient();

    const account = await callTool(mcpClient, KLAVIYO_ACCOUNT_GET_TOOL, {});
    expect(account.isError).not.toBe(true);

    const campaigns = await callTool(mcpClient, KLAVIYO_CAMPAIGN_LIST_TOOL, {
      limit: 10,
    });
    expect(campaigns.isError).not.toBe(true);

    const campaign = await callTool(mcpClient, KLAVIYO_CAMPAIGN_GET_TOOL, {
      campaignId: MOCK_CAMPAIGN_ID,
    });
    expect(campaign.isError).not.toBe(true);

    const flows = await callTool(mcpClient, KLAVIYO_FLOW_LIST_TOOL, {
      limit: 10,
    });
    expect(flows.isError).not.toBe(true);

    const flow = await callTool(mcpClient, KLAVIYO_FLOW_GET_TOOL, {
      flowId: MOCK_FLOW_ID,
    });
    expect(flow.isError).not.toBe(true);

    const metrics = await callTool(mcpClient, KLAVIYO_METRIC_LIST_TOOL, {
      limit: 10,
    });
    expect(metrics.isError).not.toBe(true);

    const metric = await callTool(mcpClient, KLAVIYO_METRIC_GET_TOOL, {
      metricId: MOCK_METRIC_ID,
    });
    expect(metric.isError).not.toBe(true);

    const events = await callTool(mcpClient, KLAVIYO_EVENT_LIST_TOOL, {
      startDatetime: "2024-06-01T00:00:00+00:00",
      endDatetime: "2024-06-02T00:00:00+00:00",
      limit: 10,
    });
    expect(events.isError).not.toBe(true);

    const eventsUrl = server.getLastEventsUrl() ?? "";
    expect(eventsUrl).not.toMatch(/include/i);

    const campaignReport = await callTool(
      mcpClient,
      KLAVIYO_REPORT_CAMPAIGN_TOOL,
      {
        statistics: ["opens", "open_rate"],
        timeframeKey: "last_30_days",
        conversionMetricId: MOCK_METRIC_ID,
        groupBy: ["campaign_id", "send_channel"],
      },
    );
    expect(campaignReport.isError).not.toBe(true);

    const flowReport = await callTool(mcpClient, KLAVIYO_REPORT_FLOW_TOOL, {
      statistics: ["clicks", "delivery_rate"],
      timeframeKey: "last_7_days",
      conversionMetricId: MOCK_METRIC_ID,
      groupBy: ["flow_id", "send_channel"],
    });
    expect(flowReport.isError).not.toBe(true);
  });

  it("maps forbidden provider errors", async () => {
    const mapped = mapKlaviyoError(
      {
        kind: "http",
        status: 403,
        klaviyoCode: "permission_denied",
      },
      { privateApiKey: FAKE_KLAVIYO_PRIVATE_API_KEY },
    );
    expect(mapped.code).toBe("FORBIDDEN");
  });

  it("returns MCP errors for invalid input", async () => {
    const { mcpClient } = await createLinkedClient();
    const invalid = await callTool(mcpClient, KLAVIYO_REPORT_CAMPAIGN_TOOL, {
      statistics: ["not-a-real-statistic"],
      timeframeKey: "last_30_days",
      conversionMetricId: MOCK_METRIC_ID,
    });
    expect(invalid.isError).toBe(true);
  });

  it("rejects malicious pagination links from provider", async () => {
    const { mcpClient } = await createLinkedClient("malicious_paging");
    const result = await callTool(mcpClient, KLAVIYO_CAMPAIGN_LIST_TOOL, {
      limit: 10,
    });
    expect(result.isError).toBe(true);
  });
});
