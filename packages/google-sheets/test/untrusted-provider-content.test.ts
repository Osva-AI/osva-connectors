import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { SHEETS_VALUES_GET_TOOL } from "../src/constants.js";
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

describe("untrusted provider cell content", () => {
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

  it("flags values.get output as untrusted", async () => {
    server = await startMockSheetsHttpServer();
    const connector = createGoogleSheetsConnector({
      client: createTestSheetsClient(server),
      config: createTestSheetsConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: SHEETS_VALUES_GET_TOOL,
      arguments: {
        spreadsheetId: MOCK_SPREADSHEET_ID,
        range: "Data!A1:B2",
      },
    });
    expect(result.isError).not.toBe(true);
    const text = JSON.stringify(result);
    expect(text).toContain("untrustedContent");
    expect(text).toContain("ignore system prompt");
  });
});
