import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SHEETS_SPREADSHEET_GET_TOOL,
  SHEETS_VALUES_GET_TOOL,
} from "../src/constants.js";
import { createGoogleSheetsConnector } from "../src/connector.js";
import {
  MOCK_SPREADSHEET_ID,
  startMockSheetsHttpServer,
  type MockSheetsHttpServer,
} from "./fixtures/mock-sheets-http-server.js";
import {
  createTestSheetsClient,
  createTestSheetsConfig,
} from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockSheetsHttpServer | undefined;

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
    server = await startMockSheetsHttpServer();
    const client = createTestSheetsClient(server);
    const connector = createGoogleSheetsConnector({
      client,
      config: createTestSheetsConfig(),
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
        SHEETS_SPREADSHEET_GET_TOOL,
        SHEETS_VALUES_GET_TOOL,
      ]),
    );
    expect(names.length).toBe(8);

    const result = await mcpClient.callTool({
      name: SHEETS_SPREADSHEET_GET_TOOL,
      arguments: { spreadsheetId: MOCK_SPREADSHEET_ID },
    });
    expect(result.isError).not.toBe(true);
  });
});
