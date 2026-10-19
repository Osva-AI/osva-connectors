import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GA4_METADATA_GET_TOOL,
  GA4_PROPERTY_GET_TOOL,
  GA4_PROPERTY_LIST_TOOL,
  GA4_REPORT_ACQUISITION_TOOL,
  GA4_REPORT_ECOMMERCE_TOOL,
  GA4_REPORT_REALTIME_TOOL,
  GA4_REPORT_RUN_TOOL,
} from "../src/constants.js";
import { createGa4Connector } from "../src/connector.js";
import { mapGa4Error } from "../src/map-ga4-error.js";
import {
  FAKE_GA4_ACCESS_TOKEN,
  MOCK_PROPERTY_ID,
  startMockGa4HttpServer,
  type MockGa4HttpServer,
} from "./fixtures/mock-ga4-http-server.js";
import { createTestGa4Client } from "./helpers/test-env.js";

describe("GA4 connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockGa4HttpServer | undefined;

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
    mode?: import("./fixtures/mock-ga4-http-server.js").MockGa4Mode,
  ) {
    server = await startMockGa4HttpServer(mode ? { mode } : {});
    const client = createTestGa4Client(server);
    const connector = createGa4Connector({
      client,
      defaultPropertyId: MOCK_PROPERTY_ID,
      accessTokenForRedaction: FAKE_GA4_ACCESS_TOKEN,
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

  it("exercises all seven tools against the fake provider", async () => {
    const mcpClient = await createLinkedClient();

    const listed = await callTool(mcpClient, GA4_PROPERTY_LIST_TOOL, {
      limit: 10,
    });
    expect(listed.isError).not.toBe(true);
    expect(listed.structuredContent).toMatchObject({
      properties: expect.arrayContaining([
        expect.objectContaining({ propertyId: MOCK_PROPERTY_ID }),
      ]),
    });

    const property = await callTool(mcpClient, GA4_PROPERTY_GET_TOOL, {});
    expect(property.isError).not.toBe(true);
    expect(property.structuredContent).toMatchObject({
      id: MOCK_PROPERTY_ID,
      currencyCode: "USD",
    });

    const metadata = await callTool(mcpClient, GA4_METADATA_GET_TOOL, {
      type: "all",
      search: "country",
    });
    expect(metadata.isError).not.toBe(true);
    expect(metadata.structuredContent).toMatchObject({
      localPagination: true,
      totalMatched: expect.any(Number),
    });

    const report = await callTool(mcpClient, GA4_REPORT_RUN_TOOL, {
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      metrics: ["activeUsers"],
      dimensions: ["country"],
    });
    expect(report.isError).not.toBe(true);
    expect(report.structuredContent).toMatchObject({
      propertyId: MOCK_PROPERTY_ID,
      rowCount: 1,
      rows: expect.any(Array),
    });

    const realtime = await callTool(mcpClient, GA4_REPORT_REALTIME_TOOL, {});
    expect(realtime.isError).not.toBe(true);

    const acquisition = await callTool(mcpClient, GA4_REPORT_ACQUISITION_TOOL, {
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      channelGrouping: "Organic Search",
    });
    expect(acquisition.isError).not.toBe(true);

    const ecommerceOverview = await callTool(
      mcpClient,
      GA4_REPORT_ECOMMERCE_TOOL,
      {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        breakdown: "overview",
      },
    );
    expect(ecommerceOverview.isError).not.toBe(true);

    const ecommerceProduct = await callTool(
      mcpClient,
      GA4_REPORT_ECOMMERCE_TOOL,
      {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        breakdown: "product",
      },
    );
    expect(ecommerceProduct.isError).not.toBe(true);

    const serialized = JSON.stringify([
      listed,
      property,
      metadata,
      report,
      realtime,
      acquisition,
      ecommerceOverview,
      ecommerceProduct,
    ]);
    expect(serialized).not.toContain(FAKE_GA4_ACCESS_TOKEN);
  });

  it("maps forbidden responses without leaking tokens", async () => {
    const mcpClient = await createLinkedClient("forbidden");
    const result = await callTool(mcpClient, GA4_PROPERTY_GET_TOOL, {});
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(FAKE_GA4_ACCESS_TOKEN);
  });

  it("surfaces provider invalid report errors", async () => {
    const mcpClient = await createLinkedClient("incompatible_report");
    const result = await callTool(mcpClient, GA4_REPORT_RUN_TOOL, {
      startDate: "2024-01-01",
      endDate: "2024-01-02",
      metrics: ["activeUsers"],
    });
    expect(result.isError).toBe(true);
  });
});

describe("mapGa4Error integration", () => {
  it("sanitizes http forbidden", () => {
    const mapped = mapGa4Error(
      { kind: "http", status: 403, googleStatus: "PERMISSION_DENIED" },
      { accessToken: FAKE_GA4_ACCESS_TOKEN },
    );
    expect(mapped.code).toBe("FORBIDDEN");
  });
});
