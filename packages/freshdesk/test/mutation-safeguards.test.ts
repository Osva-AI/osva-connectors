import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  FRESHDESK_TICKET_NOTE_ADD_TOOL,
  FRESHDESK_TICKET_STATUS_SET_TOOL,
} from "../src/constants.js";
import { createFreshdeskConnector } from "../src/connector.js";
import { mapFreshdeskError } from "../src/map-freshdesk-error.js";
import {
  ticketNoteAddInputSchema,
  ticketStatusSetInputSchema,
} from "../src/tool-schemas.js";
import {
  startMockFreshdeskHttpServer,
  type MockFreshdeskHttpServer,
} from "./fixtures/mock-freshdesk-http-server.js";
import {
  createTestFreshdeskClient,
  createTestFreshdeskConfig,
} from "./helpers/test-env.js";

const TICKET_ID = 1001;
const AUTHORIZED = {
  notesEnabled: true,
  statusEnabled: true,
  hostWritesApproved: true,
  allowedResourceIds: [TICKET_ID],
};

describe("Freshdesk mutation safeguards", () => {
  const clients: Client[] = [];
  let server: MockFreshdeskHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestFreshdeskConfig>[0],
  ) {
    server = await startMockFreshdeskHttpServer();
    const client = createTestFreshdeskClient(server);
    const connector = createFreshdeskConnector({
      client,
      config: createTestFreshdeskConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({
      name: "freshdesk-mutations",
      version: "1.0",
    });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  function expectForbidden(result: Awaited<ReturnType<Client["callTool"]>>) {
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/FORBIDDEN|INVALID_INPUT/);
  }

  it("rejects private or notify_emails injection in tool schemas", () => {
    expect(
      ticketNoteAddInputSchema.safeParse({
        ticketId: TICKET_ID,
        body: "note",
        private: false,
      }).success,
    ).toBe(false);
    expect(
      ticketNoteAddInputSchema.safeParse({
        ticketId: TICKET_ID,
        body: "note",
        notify_emails: ["customer@example.test"],
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
      name: FRESHDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getNotePostCount()).toBe(0);
  });

  it("denies status set when disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      statusEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: FRESHDESK_TICKET_STATUS_SET_TOOL,
      arguments: { ticketId: TICKET_ID, status: "pending" },
    });
    expectForbidden(result);
    expect(mock.getStatusPutCount()).toBe(0);
  });

  it("denies mutations without host write approval", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      hostWritesApproved: false,
    });
    const result = await mcpClient.callTool({
      name: FRESHDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getNotePostCount()).toBe(0);
  });

  it("denies mutations without allowlist configuration", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedResourceIds: undefined,
    });
    const result = await mcpClient.callTool({
      name: FRESHDESK_TICKET_STATUS_SET_TOOL,
      arguments: { ticketId: TICKET_ID, status: "open" },
    });
    expectForbidden(result);
    expect(mock.getStatusPutCount()).toBe(0);
  });

  it("denies resources outside the allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedResourceIds: [4242],
    });
    const result = await mcpClient.callTool({
      name: FRESHDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getNotePostCount()).toBe(0);
  });

  it("rejects closed status by default", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: FRESHDESK_TICKET_STATUS_SET_TOOL,
      arguments: { ticketId: TICKET_ID, status: "closed" },
    });
    expectForbidden(result);
    expect(mock.getStatusPutCount()).toBe(0);
  });

  it("authorized note posts with private true", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: FRESHDESK_TICKET_NOTE_ADD_TOOL,
      arguments: { ticketId: TICKET_ID, body: "private investigation" },
    });
    expect(result.isError).not.toBe(true);
    expect(mock.getNotePostCount()).toBe(1);
    const body = mock.getLastNoteBody() as { private?: boolean; body?: string };
    expect(body.private).toBe(true);
    expect(body.body).toBe("private investigation");
  });

  it("maps ambiguous mutation failures", () => {
    const mapped = mapFreshdeskError(
      { kind: "http", status: 504 },
      { ambiguousWrite: true },
    );
    expect(mapped.message).toMatch(/ambiguous/i);
  });
});
