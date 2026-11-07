import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  ONEDRIVE_DRIVE_GET_TOOL,
  ONEDRIVE_ITEM_LIST_TOOL,
} from "../src/constants.js";
import { createOneDriveConnector } from "../src/connector.js";
import {
  startMockGraphHttpServer,
  type MockGraphHttpServer,
} from "./fixtures/mock-graph-http-server.js";
import {
  createTestOneDriveClient,
  createTestOneDriveConfig,
} from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockGraphHttpServer | undefined;

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
    server = await startMockGraphHttpServer();
    const client = createTestOneDriveClient(server);
    const connector = createOneDriveConnector({
      client,
      config: createTestOneDriveConfig(),
      graphApiHost: server.graphApiOrigin,
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
        ONEDRIVE_DRIVE_GET_TOOL,
        ONEDRIVE_ITEM_LIST_TOOL,
      ]),
    );
    expect(names.length).toBe(6);

    const result = await mcpClient.callTool({
      name: ONEDRIVE_DRIVE_GET_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
  });
});
