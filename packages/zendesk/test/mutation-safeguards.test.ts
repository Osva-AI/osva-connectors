import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  ZENDESK_TICKET_NOTE_ADD_TOOL,
  ZENDESK_TICKET_STATUS_SET_TOOL,
} from "../src/constants.js";
import { createZendeskConnector } from "../src/connector.js";
import { mapZendeskError } from "../src/map-zendesk-error.js";
import {
  ticketNoteAddInputSchema,
  ticketStatusSetInputSchema,
} from "../src/tool-schemas.js";
import {
  startMockZendeskHttpServer,
  type MockZendeskHttpServer,
} from "./fixtures/mock-zendesk-http-server.js";
import {
  createTestZendeskClient,
  createTestZendeskConfig,
} from "./helpers/test-env.js";

const TICKET_ID = 1001;
const AUTHORIZED = {
  notesEnabled: true,
  statusEnabled: true,
  hostWritesApproved: true,
  allowedResourceIds: [TICKET_ID],
};

describe("Zendesk mutation safeguards", () => {
  const clients: Client[] = [];
  let server: MockZendeskHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestZendeskConfig>[0],
  ) {
    server = await startMockZendeskHttpServer();
    const client = createTestZendeskClient(server);
    const connector = createZendeskConnector({
      client,
      config: createTestZendeskConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "zendesk-mutations", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  function expectForbidden(result: Awaited<ReturnType<Client["callTool"]>>) {
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/FORBIDDEN|INVALID_INPUT/);
  }

  it("rejects public-note and approval fields in tool input schemas", () => {
    expect(
      ticketNoteAddInputSchema.safeParse({
        ticketId: TICKET_ID,
        body: "note",
        public: true,
      }).success,
    ).toBe(false);
    expect(
      ticketStatusSetInputSchema.safeParse({
        ticketId: TICKET_ID,
        status: "open",
        hostWritesApproved: true,
      }).success,
    ).toBe(false);
  });

  it("denies note add when notes are disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      notesEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: ZENDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getTicketPutCount()).toBe(0);
  });

  it("denies status set when status updates are disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      statusEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: ZENDESK_TICKET_STATUS_SET_TOOL,
      arguments: { ticketId: TICKET_ID, status: "pending" },
    });
    expectForbidden(result);
    expect(mock.getTicketPutCount()).toBe(0);
  });

  it("denies mutations without host write approval", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      hostWritesApproved: false,
    });
    const note = await mcpClient.callTool({
      name: ZENDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "internal" },
    });
    const status = await mcpClient.callTool({
      name: ZENDESK_TICKET_STATUS_SET_TOOL,
      arguments: { ticketId: TICKET_ID, status: "pending" },
    });
    expectForbidden(note);
    expectForbidden(status);
    expect(mock.getTicketPutCount()).toBe(0);
  });

  it("denies mutations without a configured resource allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedResourceIds: undefined,
    });
    const result = await mcpClient.callTool({
      name: ZENDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getTicketPutCount()).toBe(0);
  });

  it("denies mutations when allowlist is explicitly empty", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedResourceIds: [],
    });
    const result = await mcpClient.callTool({
      name: ZENDESK_TICKET_STATUS_SET_TOOL,
      arguments: { ticketId: TICKET_ID, status: "open" },
    });
    expectForbidden(result);
    expect(mock.getTicketPutCount()).toBe(0);
  });

  it("denies mutations for resources outside the allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedResourceIds: [9999],
    });
    const result = await mcpClient.callTool({
      name: ZENDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getTicketPutCount()).toBe(0);
  });

  it("rejects disallowed ticket statuses such as closed", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: ZENDESK_TICKET_STATUS_SET_TOOL,
      arguments: { ticketId: TICKET_ID, status: "closed" },
    });
    expectForbidden(result);
    expect(mock.getTicketPutCount()).toBe(0);
  });

  it("authorized note mutation sends a private internal comment", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: ZENDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "internal investigation" },
    });
    expect(result.isError).not.toBe(true);
    expect(mock.getTicketPutCount()).toBe(1);
    const body = mock.getLastTicketPutBody() as {
      ticket?: { comment?: { public?: boolean; body?: string } };
    };
    expect(body.ticket?.comment?.public).toBe(false);
    expect(body.ticket?.comment?.body).toBe("internal investigation");
  });

  it("maps ambiguous mutation failures with safe guidance", () => {
    const mapped = mapZendeskError(
      { kind: "http", status: 503 },
      { ambiguousWrite: true },
    );
    expect(mapped.message).toMatch(/ambiguous/i);
  });
});
