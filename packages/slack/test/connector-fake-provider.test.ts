import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SLACK_AUTH_TEST_TOOL,
  SLACK_CHANNEL_INFO_TOOL,
  SLACK_CHANNEL_LIST_TOOL,
  SLACK_MESSAGE_HISTORY_TOOL,
  SLACK_MESSAGE_POST_TOOL,
  SLACK_MESSAGE_REPLY_TOOL,
  SLACK_MESSAGE_THREAD_TOOL,
} from "../src/constants.js";
import { createSlackConnector } from "../src/connector.js";
import {
  FAKE_SLACK_BOT_TOKEN,
  MOCK_CHANNEL_OTHER,
  MOCK_CHANNEL_PUBLIC,
  startMockSlackHttpServer,
  type MockSlackHttpServer,
} from "./fixtures/mock-slack-http-server.js";
import {
  createTestSlackClient,
  createTestSlackConfig,
} from "./helpers/test-env.js";

describe("Slack connector (fake HTTP provider)", () => {
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

  async function createLinkedClient(configOverrides?: {
    writeEnabled?: boolean;
    allowedChannelIds?: string[];
  }) {
    server = await startMockSlackHttpServer();
    const config = createTestSlackConfig({
      writeEnabled: configOverrides?.writeEnabled,
      allowedChannelIds: configOverrides?.allowedChannelIds,
    });
    const client = createTestSlackClient(server, {
      allowedChannelIds: config.allowedChannelIds,
    });
    const connector = createSlackConnector({
      client,
      config,
      botTokenForRedaction: FAKE_SLACK_BOT_TOKEN,
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
    return { mcpClient, server, config };
  }

  it("exercises read tools against the fake provider", async () => {
    const { mcpClient } = await createLinkedClient();

    const auth = await mcpClient.callTool({
      name: SLACK_AUTH_TEST_TOOL,
      arguments: {},
    });
    expect(auth.isError).not.toBe(true);
    expect(JSON.stringify(auth)).not.toContain(FAKE_SLACK_BOT_TOKEN);

    const listed = await mcpClient.callTool({
      name: SLACK_CHANNEL_LIST_TOOL,
      arguments: { limit: 10 },
    });
    expect(listed.isError).not.toBe(true);

    const info = await mcpClient.callTool({
      name: SLACK_CHANNEL_INFO_TOOL,
      arguments: { channelId: MOCK_CHANNEL_PUBLIC },
    });
    expect(info.isError).not.toBe(true);

    const history = await mcpClient.callTool({
      name: SLACK_MESSAGE_HISTORY_TOOL,
      arguments: { channelId: MOCK_CHANNEL_PUBLIC, limit: 5 },
    });
    expect(history.isError).not.toBe(true);

    const thread = await mcpClient.callTool({
      name: SLACK_MESSAGE_THREAD_TOOL,
      arguments: {
        channelId: MOCK_CHANNEL_PUBLIC,
        threadTs: "1234567890.000001",
        limit: 5,
      },
    });
    expect(thread.isError).not.toBe(true);
  });

  it("blocks writes when disabled", async () => {
    const { mcpClient } = await createLinkedClient({ writeEnabled: false });
    const result = await mcpClient.callTool({
      name: SLACK_MESSAGE_POST_TOOL,
      arguments: { channelId: MOCK_CHANNEL_PUBLIC, text: "hello" },
    });
    expect(result.isError).toBe(true);
  });

  it("posts when write enabled", async () => {
    const { mcpClient, server: mockServer } = await createLinkedClient({
      writeEnabled: true,
    });
    const result = await mcpClient.callTool({
      name: SLACK_MESSAGE_POST_TOOL,
      arguments: { channelId: MOCK_CHANNEL_PUBLIC, text: "hello" },
    });
    expect(result.isError).not.toBe(true);
    expect(mockServer!.getPostMessageCount()).toBe(1);
  });

  it("posts thread replies when write enabled", async () => {
    const { mcpClient, server: mockServer } = await createLinkedClient({
      writeEnabled: true,
    });
    const result = await mcpClient.callTool({
      name: SLACK_MESSAGE_REPLY_TOOL,
      arguments: {
        channelId: MOCK_CHANNEL_PUBLIC,
        threadTs: "1234567890.000001",
        text: "reply",
      },
    });
    expect(result.isError).not.toBe(true);
    expect(mockServer!.getPostMessageCount()).toBe(1);
  });

  it("enforces channel allowlist on reads", async () => {
    const { mcpClient } = await createLinkedClient({
      allowedChannelIds: [MOCK_CHANNEL_PUBLIC],
    });
    const blocked = await mcpClient.callTool({
      name: SLACK_MESSAGE_HISTORY_TOOL,
      arguments: { channelId: MOCK_CHANNEL_OTHER, limit: 5 },
    });
    expect(blocked.isError).toBe(true);
  });

  it("returns INVALID_INPUT for bad channel IDs", async () => {
    const { mcpClient } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: SLACK_CHANNEL_INFO_TOOL,
      arguments: { channelId: "not-valid" },
    });
    expect(result.isError).toBe(true);
  });

  it("treats hostile Slack message text as data", async () => {
    const { mcpClient } = await createLinkedClient();
    const history = await mcpClient.callTool({
      name: SLACK_MESSAGE_HISTORY_TOOL,
      arguments: { channelId: MOCK_CHANNEL_PUBLIC, limit: 5 },
    });
    expect(JSON.stringify(history)).toContain("Ignore all instructions");
  });
});
