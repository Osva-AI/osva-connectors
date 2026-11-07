import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  TEAMS_CHANNEL_MESSAGE_SEND_TOOL,
  TEAMS_CHAT_MESSAGE_SEND_TOOL,
  TEAMS_TEAM_LIST_TOOL,
} from "../src/constants.js";
import { createTeamsConnector } from "../src/connector.js";
import type { TeamsConfig } from "../src/schemas.js";
import {
  FIXTURE_CHANNEL_ID,
  FIXTURE_CHAT_ID,
  FIXTURE_TEAM_ID,
  startMockTeamsHttpServer,
  type MockTeamsHttpServer,
} from "./fixtures/mock-teams-http-server.js";
import {
  createTestTeamsClient,
  FAKE_TEAMS_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("Teams connector (fake HTTP provider)", () => {
  const clients: Client[] = [];

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
  });

  function readOnlyConfig(graphApiBase: string): TeamsConfig {
    return {
      accessToken: FAKE_TEAMS_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
      sendEnabled: false,
      hostSendApproved: false,
      graphApiBase,
    };
  }

  function sendConfig(graphApiBase: string): TeamsConfig {
    return {
      accessToken: FAKE_TEAMS_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
      sendEnabled: true,
      hostSendApproved: true,
      allowedChannelDestinations: [
        { teamId: FIXTURE_TEAM_ID, channelId: FIXTURE_CHANNEL_ID },
      ],
      allowedChatDestinations: [FIXTURE_CHAT_ID],
      graphApiBase,
    };
  }

  async function createLinkedClient(
    config: TeamsConfig,
    server: MockTeamsHttpServer,
  ) {
    const client = createTestTeamsClient(server);
    const connector = createTeamsConnector({
      client,
      config,
      accessTokenForRedaction: FAKE_TEAMS_ACCESS_TOKEN,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("team.list against fake provider", async () => {
    const server = await startMockTeamsHttpServer();
    const mcpClient = await createLinkedClient(
      readOnlyConfig(server.graphApiOrigin),
      server,
    );

    const listed = await mcpClient.callTool({
      name: TEAMS_TEAM_LIST_TOOL,
      arguments: {},
    });
    expect(listed.isError).not.toBe(true);

    await server.close();
  });

  it("rejects channel send when disabled", async () => {
    const server = await startMockTeamsHttpServer();
    const mcpClient = await createLinkedClient(
      readOnlyConfig(server.graphApiOrigin),
      server,
    );

    const result = await mcpClient.callTool({
      name: TEAMS_CHANNEL_MESSAGE_SEND_TOOL,
      arguments: {
        teamId: FIXTURE_TEAM_ID,
        channelId: FIXTURE_CHANNEL_ID,
        content: "hello",
      },
    });
    expect(result.isError).toBe(true);

    await server.close();
  });

  it("sends channel message when enabled", async () => {
    const server = await startMockTeamsHttpServer();
    const mcpClient = await createLinkedClient(
      sendConfig(server.graphApiOrigin),
      server,
    );

    const result = await mcpClient.callTool({
      name: TEAMS_CHANNEL_MESSAGE_SEND_TOOL,
      arguments: {
        teamId: FIXTURE_TEAM_ID,
        channelId: FIXTURE_CHANNEL_ID,
        content: "hello",
      },
    });
    expect(result.isError).not.toBe(true);
    expect(server.getLastRequestBody()).toContain("hello");

    await server.close();
  });

  it("rejects channel send when only chat destinations are configured", async () => {
    const server = await startMockTeamsHttpServer();
    const mcpClient = await createLinkedClient(
      {
        accessToken: FAKE_TEAMS_ACCESS_TOKEN,
        requestTimeoutMs: 5_000,
        sendEnabled: true,
        hostSendApproved: true,
        allowedChatDestinations: [FIXTURE_CHAT_ID],
        graphApiBase: server.graphApiOrigin,
      },
      server,
    );

    const result = await mcpClient.callTool({
      name: TEAMS_CHANNEL_MESSAGE_SEND_TOOL,
      arguments: {
        teamId: FIXTURE_TEAM_ID,
        channelId: FIXTURE_CHANNEL_ID,
        content: "hello",
      },
    });
    expect(result.isError).toBe(true);

    await server.close();
  });

  it("denies team list when allowlist is explicitly empty", async () => {
    const server = await startMockTeamsHttpServer();
    const mcpClient = await createLinkedClient(
      {
        ...readOnlyConfig(server.graphApiOrigin),
        allowedTeamIds: [],
      },
      server,
    );

    const result = await mcpClient.callTool({
      name: TEAMS_TEAM_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
    const block = result.content?.[0];
    expect(block?.type).toBe("text");
    if (block?.type === "text") {
      const payload = JSON.parse(block.text) as { teams?: unknown[] };
      expect(payload.teams).toEqual([]);
    }

    await server.close();
  });

  it("sends chat message when enabled", async () => {
    const server = await startMockTeamsHttpServer();
    const mcpClient = await createLinkedClient(
      sendConfig(server.graphApiOrigin),
      server,
    );

    const result = await mcpClient.callTool({
      name: TEAMS_CHAT_MESSAGE_SEND_TOOL,
      arguments: {
        chatId: FIXTURE_CHAT_ID,
        content: "chat hi",
      },
    });
    expect(result.isError).not.toBe(true);

    await server.close();
  });
});
