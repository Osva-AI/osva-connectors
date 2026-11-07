import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import {
  ConnectorSdkError,
  createMcpServerFromConnector,
} from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { AMPLITUDE_EVENT_SEGMENTATION_TOOL } from "../src/constants.js";
import { createAmplitudeConnector } from "../src/connector.js";
import { loadAmplitudeConfig } from "../src/config.js";
import {
  startMockAmplitudeHttpServer,
  type MockAmplitudeHttpServer,
  type MockAmplitudeMode,
} from "./fixtures/mock-amplitude-http-server.js";
import {
  createTestAmplitudeClient,
  FAKE_AMPLITUDE_API_KEY,
  FAKE_AMPLITUDE_SECRET_KEY,
} from "./helpers/test-env.js";

describe("security regression", () => {
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

  async function linkedClient(mode?: MockAmplitudeMode) {
    server = await startMockAmplitudeHttpServer(mode ? { mode } : {});
    const client = createTestAmplitudeClient(server);
    const connector = createAmplitudeConnector({
      client,
      apiKeyForRedaction: FAKE_AMPLITUDE_API_KEY,
      secretKeyForRedaction: FAKE_AMPLITUDE_SECRET_KEY,
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
    expect(() => loadAmplitudeConfig({})).toThrow(ConnectorSdkError);
  });

  it("rejects lookback beyond 90 days via MCP schema", async () => {
    const { mcpClient } = await linkedClient();
    const result = await mcpClient.callTool({
      name: AMPLITUDE_EVENT_SEGMENTATION_TOOL,
      arguments: {
        start: "20240101",
        end: "20240601",
        event: { event_type: "Purchase" },
      },
    });
    expect(result.isError).toBe(true);
  });

  it("surfaces forbidden failures from provider", async () => {
    const { mcpClient } = await linkedClient("forbidden");
    const result = await mcpClient.callTool({
      name: AMPLITUDE_EVENT_SEGMENTATION_TOOL,
      arguments: {
        start: "20240601",
        end: "20240607",
        event: { event_type: "Purchase" },
      },
    });
    expect(result.isError).toBe(true);
  });
});
