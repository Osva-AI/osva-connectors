import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SHEETS_SHEET_ADD_TOOL,
  SHEETS_SHEET_LIST_TOOL,
  SHEETS_SPREADSHEET_GET_TOOL,
  SHEETS_VALUES_APPEND_TOOL,
  SHEETS_VALUES_BATCH_GET_TOOL,
  SHEETS_VALUES_BATCH_UPDATE_TOOL,
  SHEETS_VALUES_GET_TOOL,
  SHEETS_VALUES_UPDATE_TOOL,
} from "../src/constants.js";
import {
  createGoogleSheetsConnector,
  type CreateGoogleSheetsConnectorOptions,
} from "../src/connector.js";
import { mapSheetsError } from "../src/map-sheets-error.js";
import {
  MOCK_OTHER_SPREADSHEET_ID,
  MOCK_SPREADSHEET_ID,
  startMockSheetsHttpServer,
  type MockSheetsHttpServer,
} from "./fixtures/mock-sheets-http-server.js";
import {
  createTestSheetsClient,
  createTestSheetsConfig,
  FAKE_SHEETS_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("Google Sheets connector (fake HTTP provider)", () => {
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

  async function createLinkedClient(
    connectorOptions?: Partial<CreateGoogleSheetsConnectorOptions>,
  ) {
    server = await startMockSheetsHttpServer();
    const client = createTestSheetsClient(server);
    const connector = createGoogleSheetsConnector({
      client,
      config: createTestSheetsConfig({ writeEnabled: true }),
      accessTokenForRedaction: FAKE_SHEETS_ACCESS_TOKEN,
      ...connectorOptions,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("covers all eight tools against mock provider", async () => {
    const { mcpClient } = await createLinkedClient();
    const tools = [
      [SHEETS_SPREADSHEET_GET_TOOL, { spreadsheetId: MOCK_SPREADSHEET_ID }],
      [SHEETS_SHEET_LIST_TOOL, { spreadsheetId: MOCK_SPREADSHEET_ID }],
      [
        SHEETS_VALUES_GET_TOOL,
        { spreadsheetId: MOCK_SPREADSHEET_ID, range: "Data!A1:B2" },
      ],
      [
        SHEETS_VALUES_BATCH_GET_TOOL,
        {
          spreadsheetId: MOCK_SPREADSHEET_ID,
          ranges: ["Data!A1", "Data!B1"],
        },
      ],
      [
        SHEETS_VALUES_APPEND_TOOL,
        {
          spreadsheetId: MOCK_SPREADSHEET_ID,
          range: "Data!A1",
          values: [["x", "y"]],
        },
      ],
      [
        SHEETS_VALUES_UPDATE_TOOL,
        {
          spreadsheetId: MOCK_SPREADSHEET_ID,
          range: "Data!A1",
          values: [["x"]],
        },
      ],
      [
        SHEETS_VALUES_BATCH_UPDATE_TOOL,
        {
          spreadsheetId: MOCK_SPREADSHEET_ID,
          data: [{ range: "Data!A1", values: [["z"]] }],
        },
      ],
      [
        SHEETS_SHEET_ADD_TOOL,
        { spreadsheetId: MOCK_SPREADSHEET_ID, title: "New Tab" },
      ],
    ] as const;

    for (const [name, args] of tools) {
      const result = await mcpClient.callTool({ name, arguments: { ...args } });
      expect(result.isError).not.toBe(true);
    }
  });

  it("retries read-only GET once on rate limit", async () => {
    server = await startMockSheetsHttpServer({ mode: "rate_limit_once" });
    const client = createTestSheetsClient(server);
    await client.getSpreadsheet({ spreadsheetId: MOCK_SPREADSHEET_ID });
    expect(server.getRequestCount()).toBe(2);
  });

  it("does not retry mutations on server error", async () => {
    server = await startMockSheetsHttpServer({ mode: "server_error" });
    const client = createTestSheetsClient(server);
    await expect(
      client.appendValues({
        spreadsheetId: MOCK_SPREADSHEET_ID,
        range: "Data!A1",
        values: [["a"]],
      }),
    ).rejects.toBeTruthy();
    expect(server.getMutationCount()).toBe(0);
    expect(server.getRequestCount()).toBe(1);
  });

  it("enforces spreadsheet allowlist", async () => {
    const { mcpClient } = await createLinkedClient({
      config: createTestSheetsConfig({
        writeEnabled: true,
        allowedSpreadsheetIds: [MOCK_SPREADSHEET_ID],
      }),
    });
    const blocked = await mcpClient.callTool({
      name: SHEETS_SPREADSHEET_GET_TOOL,
      arguments: { spreadsheetId: MOCK_OTHER_SPREADSHEET_ID },
    });
    expect(blocked.isError).toBe(true);
  });

  it("maps provider errors without leaking tokens", () => {
    const mapped = mapSheetsError(
      new Error(`Bearer ${FAKE_SHEETS_ACCESS_TOKEN}`),
      {
        accessToken: FAKE_SHEETS_ACCESS_TOKEN,
      },
    );
    expect(mapped.message).not.toContain(FAKE_SHEETS_ACCESS_TOKEN);
  });
});
