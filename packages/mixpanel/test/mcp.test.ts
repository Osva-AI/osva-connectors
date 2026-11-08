import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  MIXPANEL_EVENT_TOP_TOOL,
  MIXPANEL_REPORT_GET_TOOL,
  MIXPANEL_SEGMENTATION_RUN_TOOL,
} from "../src/constants.js";
import { createMixpanelConnector } from "../src/connector.js";
import {
  FAKE_MIXPANEL_SECRET,
  FAKE_MIXPANEL_USERNAME,
  startMockMixpanelHttpServer,
  type MockMixpanelHttpServer,
} from "./fixtures/mock-mixpanel-http-server.js";
import {
  createTestMixpanelClient,
  createTestMixpanelConfig,
} from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockMixpanelHttpServer | undefined;

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
    server = await startMockMixpanelHttpServer();
    const client = createTestMixpanelClient(server);
    const connector = createMixpanelConnector({
      client,
      config: createTestMixpanelConfig(),
      credentialsForRedaction: {
        username: FAKE_MIXPANEL_USERNAME,
        secret: FAKE_MIXPANEL_SECRET,
      },
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
        MIXPANEL_REPORT_GET_TOOL,
        MIXPANEL_SEGMENTATION_RUN_TOOL,
        MIXPANEL_EVENT_TOP_TOOL,
      ]),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(6);

    const result = await mcpClient.callTool({
      name: MIXPANEL_EVENT_TOP_TOOL,
      arguments: { limit: 5 },
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result)).not.toContain(FAKE_MIXPANEL_SECRET);
  });

  it("returns INVALID_INPUT for malformed segmentation input", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: MIXPANEL_SEGMENTATION_RUN_TOOL,
      arguments: {
        event: "bad\nline",
        fromDate: "2024-01-01",
        toDate: "2024-01-02",
      },
    });
    expect(result.isError).toBe(true);
  });
});
