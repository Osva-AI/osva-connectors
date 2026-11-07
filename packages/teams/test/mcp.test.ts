import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  TEAMS_TEAM_LIST_TOOL,
  TEAMS_CHANNEL_LIST_TOOL,
} from "../src/constants.js";
import { createTeamsConnector } from "../src/connector.js";
import type { TeamsConfig } from "../src/schemas.js";
import { startMockTeamsHttpServer } from "./fixtures/mock-teams-http-server.js";
import { createTestTeamsClient } from "./helpers/test-env.js";
import { FIXTURE_TEAM_ID } from "./fixtures/mock-teams-http-server.js";

describe("MCP compatibility (teams)", () => {
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

  const readOnlyConfig = (graphApiBase: string): TeamsConfig => ({
    accessToken: "test-token",
    requestTimeoutMs: 5_000,
    sendEnabled: false,
    hostSendApproved: false,
    graphApiBase,
  });

  it("supports tools/list and tools/call", async () => {
    const server = await startMockTeamsHttpServer();
    const client = createTestTeamsClient(server);
    const connector = createTeamsConnector({
      client,
      config: readOnlyConfig(server.graphApiOrigin),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([TEAMS_TEAM_LIST_TOOL]));
    expect(names.length).toBe(8);

    const result = await mcpClient.callTool({
      name: TEAMS_TEAM_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);

    const channels = await mcpClient.callTool({
      name: TEAMS_CHANNEL_LIST_TOOL,
      arguments: { teamId: FIXTURE_TEAM_ID },
    });
    expect(channels.isError).not.toBe(true);

    await server.close();
  });
});
