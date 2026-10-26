import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { DRIVE_FILE_GET_TOOL, DRIVE_FILE_LIST_TOOL } from "../src/constants.js";
import { createGoogleDriveConnector } from "../src/connector.js";
import {
  MOCK_DRIVE_ID,
  startMockDriveHttpServer,
  type MockDriveHttpServer,
} from "./fixtures/mock-drive-http-server.js";
import { createTestDriveClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockDriveHttpServer | undefined;

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
    server = await startMockDriveHttpServer();
    const client = createTestDriveClient(server);
    const connector = createGoogleDriveConnector({
      client,
      maxContentBytes: 262_144,
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
      expect.arrayContaining([DRIVE_FILE_LIST_TOOL, DRIVE_FILE_GET_TOOL]),
    );
    expect(names.length).toBe(8);

    const result = await mcpClient.callTool({
      name: DRIVE_FILE_LIST_TOOL,
      arguments: { driveId: MOCK_DRIVE_ID, includeSharedDrives: true },
    });
    expect(result.isError).not.toBe(true);
  });
});
