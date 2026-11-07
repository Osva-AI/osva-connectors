import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  AMPLITUDE_CHART_GET_TOOL,
  AMPLITUDE_FUNNEL_RUN_TOOL,
  AMPLITUDE_SESSION_AVERAGE_TOOL,
} from "../src/constants.js";
import { createAmplitudeConnector } from "../src/connector.js";
import { mapAmplitudeError } from "../src/map-amplitude-error.js";
import {
  MOCK_CHART_ID,
  startMockAmplitudeHttpServer,
  type MockAmplitudeHttpServer,
} from "./fixtures/mock-amplitude-http-server.js";
import {
  createTestAmplitudeClient,
  FAKE_AMPLITUDE_API_KEY,
  FAKE_AMPLITUDE_SECRET_KEY,
} from "./helpers/test-env.js";

describe("Amplitude connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockAmplitudeHttpServer | undefined;

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

  async function createLinkedClient(allowedChartIds?: readonly string[]) {
    server = await startMockAmplitudeHttpServer();
    const client = createTestAmplitudeClient(server);
    const connector = createAmplitudeConnector({
      client,
      ...(allowedChartIds !== undefined ? { allowedChartIds } : {}),
      apiKeyForRedaction: FAKE_AMPLITUDE_API_KEY,
      secretKeyForRedaction: FAKE_AMPLITUDE_SECRET_KEY,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "fake-provider", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("returns providerCalculated labels on series tools", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: AMPLITUDE_SESSION_AVERAGE_TOOL,
      arguments: { start: "20240601", end: "20240607" },
    });
    expect(result.isError).not.toBe(true);
    const text = JSON.stringify(result);
    expect(text).toContain("providerCalculated");
  });

  it("rejects more than five funnel steps", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: AMPLITUDE_FUNNEL_RUN_TOOL,
      arguments: {
        start: "20240601",
        end: "20240607",
        events: Array.from({ length: 6 }, (_, index) => ({
          event_type: `Step${index}`,
        })),
      },
    });
    expect(result.isError).toBe(true);
  });

  it("enforces chart allowlist", async () => {
    const mcpClient = await createLinkedClient([MOCK_CHART_ID]);
    const denied = await mcpClient.callTool({
      name: AMPLITUDE_CHART_GET_TOOL,
      arguments: { chartId: "other_chart" },
    });
    expect(denied.isError).toBe(true);

    const allowed = await mcpClient.callTool({
      name: AMPLITUDE_CHART_GET_TOOL,
      arguments: { chartId: MOCK_CHART_ID },
    });
    expect(allowed.isError).not.toBe(true);
  });

  it("maps provider HTTP errors via mapAmplitudeError", () => {
    const mapped = mapAmplitudeError(
      { kind: "http", status: 429 },
      { apiKey: FAKE_AMPLITUDE_API_KEY },
    );
    expect(mapped.code).toBe("RATE_LIMITED");
  });
});
