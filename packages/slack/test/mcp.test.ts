import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SLACK_AUTH_TEST_TOOL,
  SLACK_MESSAGE_POST_TOOL,
} from "../src/constants.js";
import { createSlackConnector } from "../src/connector.js";
import {
  FAKE_SLACK_BOT_TOKEN,
  MOCK_CHANNEL_PUBLIC,
  startMockSlackHttpServer,
  type MockSlackHttpServer,
} from "./fixtures/mock-slack-http-server.js";
import {
  createTestSlackClient,
  createTestSlackConfig,
} from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockSlackHttpServer | undefined;

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
    server = await startMockSlackHttpServer();
    const config = createTestSlackConfig();
    const client = createTestSlackClient(server);
    const connector = createSlackConnector({
      client,
      config,
      botTokenForRedaction: FAKE_SLACK_BOT_TOKEN,
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
    expect(names.length).toBe(7);
    expect(new Set(names).size).toBe(7);

    const result = await mcpClient.callTool({
      name: SLACK_AUTH_TEST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result)).not.toContain(FAKE_SLACK_BOT_TOKEN);
  });

  it("returns INVALID_INPUT for malformed post input", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: SLACK_MESSAGE_POST_TOOL,
      arguments: { channelId: MOCK_CHANNEL_PUBLIC, text: "" },
    });
    expect(result.isError).toBe(true);
  });
});
