import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { SHEETS_VALUES_APPEND_TOOL } from "../src/constants.js";
import { createGoogleSheetsConnector } from "../src/connector.js";
import { mapSheetsError } from "../src/map-sheets-error.js";
import {
  MOCK_SPREADSHEET_ID,
  startMockSheetsHttpServer,
  type MockSheetsHttpServer,
} from "./fixtures/mock-sheets-http-server.js";
import {
  createTestSheetsClient,
  createTestSheetsConfig,
} from "./helpers/test-env.js";

describe("Google Sheets write semantics", () => {
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

  async function createWriteClient(writeEnabled: boolean) {
    server = await startMockSheetsHttpServer();
    const connector = createGoogleSheetsConnector({
      client: createTestSheetsClient(server),
      config: createTestSheetsConfig({ writeEnabled }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "write-test", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("blocks append when writeEnabled is false", async () => {
    const { mcpClient } = await createWriteClient(false);
    const result = await mcpClient.callTool({
      name: SHEETS_VALUES_APPEND_TOOL,
      arguments: {
        spreadsheetId: MOCK_SPREADSHEET_ID,
        range: "Data!A1",
        values: [["a"]],
      },
    });
    expect(result.isError).toBe(true);
  });

  it("maps ambiguous write failures without retryable hints", () => {
    const timeout = new Error("Google Sheets request timed out.");
    timeout.name = "TimeoutError";
    const mapped = mapSheetsError(timeout, { ambiguousWrite: true });
    expect(mapped.retryable).not.toBe(true);
    expect(mapped.message).toContain("verify in the spreadsheet");
  });

  it("returns indeterminate messaging on ambiguous write provider failure", async () => {
    server = await startMockSheetsHttpServer({ mode: "server_error" });
    const connector = createGoogleSheetsConnector({
      client: createTestSheetsClient(server),
      config: createTestSheetsConfig({ writeEnabled: true }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "write-test", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: SHEETS_VALUES_APPEND_TOOL,
      arguments: {
        spreadsheetId: MOCK_SPREADSHEET_ID,
        range: "Data!A1",
        values: [["a"]],
      },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("verify in the spreadsheet");
    expect(server.getRequestCount()).toBe(1);
  });
});
