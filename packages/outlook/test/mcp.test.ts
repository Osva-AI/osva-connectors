import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  OUTLOOK_CALENDAR_LIST_TOOL,
  OUTLOOK_MAIL_FOLDER_LIST_TOOL,
} from "../src/constants.js";
import { createOutlookConnector } from "../src/connector.js";
import type { OutlookConfig } from "../src/schemas.js";
import { startMockGraphHttpServer } from "./fixtures/mock-graph-http-server.js";
import {
  createTestOutlookClient,
  FAKE_OUTLOOK_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("MCP compatibility (outlook)", () => {
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

  const readOnlyConfig: OutlookConfig = {
    accessToken: FAKE_OUTLOOK_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
    sendEnabled: false,
    hostSendApproved: false,
    writeEnabled: false,
    hostWritesApproved: false,
  };

  it("supports tools/list and tools/call", async () => {
    const server = await startMockGraphHttpServer();
    const client = createTestOutlookClient(server);
    const connector = createOutlookConnector({
      client,
      config: readOnlyConfig,
      graphApiHost: server.graphApiOrigin,
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
    expect(names).toEqual(
      expect.arrayContaining([
        OUTLOOK_MAIL_FOLDER_LIST_TOOL,
        OUTLOOK_CALENDAR_LIST_TOOL,
      ]),
    );
    expect(names.length).toBe(9);

    const result = await mcpClient.callTool({
      name: OUTLOOK_MAIL_FOLDER_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);

    await server.close();
  });
});
