import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  ZOHO_DEAL_GET_TOOL,
  ZOHO_DEAL_LIST_TOOL,
  ZOHO_DEAL_NOTE_ADD_TOOL,
  ZOHO_DEAL_STAGE_LIST_TOOL,
} from "../src/constants.js";
import { createZohoConnector } from "../src/connector.js";
import {
  FIXTURE_DEAL_ID,
  startMockZohoHttpServer,
  type MockZohoHttpServer,
} from "./fixtures/mock-zoho-http-server.js";
import {
  createTestZohoClient,
  createTestZohoConfig,
} from "./helpers/test-env.js";

describe("Zoho CRM connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockZohoHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestZohoConfig>[0],
  ) {
    server = await startMockZohoHttpServer();
    const client = createTestZohoClient(server);
    const connector = createZohoConnector({
      client,
      config: createTestZohoConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "zoho-fake", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("lists and gets deals with string ids in output", async () => {
    const mcpClient = await createLinkedClient({
      allowedDealIds: [FIXTURE_DEAL_ID],
    });
    const list = await mcpClient.callTool({
      name: ZOHO_DEAL_LIST_TOOL,
      arguments: { page: 1 },
    });
    expect(list.isError).not.toBe(true);
    const listText = JSON.stringify(list.structuredContent ?? list.content);
    expect(listText).toContain(FIXTURE_DEAL_ID);
    expect(listText).not.toMatch(/"id":\s*\d{16}/);

    const get = await mcpClient.callTool({
      name: ZOHO_DEAL_GET_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID },
    });
    expect(get.isError).not.toBe(true);
    const getText = JSON.stringify(get.structuredContent ?? get.content);
    expect(getText).toContain(FIXTURE_DEAL_ID);
    expect(getText).not.toMatch(/"id":\s*\d{16}/);
  });

  it("lists deal stages from field metadata", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_STAGE_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
    const text = JSON.stringify(result.structuredContent ?? result.content);
    expect(text).toMatch(/Qualification/);
  });

  it("blocks note mutations without gates", async () => {
    const mcpClient = await createLinkedClient({
      allowedDealIds: [FIXTURE_DEAL_ID],
    });
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_NOTE_ADD_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID, body: "internal" },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects numeric deal ids in tool input", async () => {
    const mcpClient = await createLinkedClient({
      allowedDealIds: [FIXTURE_DEAL_ID],
    });
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_GET_TOOL,
      arguments: { dealId: 9001000000001001 },
    });
    expect(result.isError).toBe(true);
  });
});
