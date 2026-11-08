import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
  INTERCOM_CONVERSATION_STATE_SET_TOOL,
} from "../src/constants.js";
import { createIntercomConnector } from "../src/connector.js";
import { mapIntercomError } from "../src/map-intercom-error.js";
import {
  conversationNoteAddInputSchema,
  conversationStateSetInputSchema,
} from "../src/tool-schemas.js";
import {
  startMockIntercomHttpServer,
  type MockIntercomHttpServer,
} from "./fixtures/mock-intercom-http-server.js";
import {
  createTestIntercomClient,
  createTestIntercomConfig,
} from "./helpers/test-env.js";

const CONVERSATION_ID = "conv_fixture_1001";
const AUTHORIZED = {
  notesEnabled: true,
  statusEnabled: true,
  hostWritesApproved: true,
  allowedResourceIds: [CONVERSATION_ID],
  adminId: "admin_fixture",
};

describe("Intercom mutation safeguards", () => {
  const clients: Client[] = [];
  let server: MockIntercomHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestIntercomConfig>[0],
  ) {
    server = await startMockIntercomHttpServer();
    const client = createTestIntercomClient(server);
    const connector = createIntercomConnector({
      client,
      config: createTestIntercomConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({
      name: "intercom-mutations",
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

  it("rejects customer-reply injection fields in tool schemas", () => {
    expect(
      conversationNoteAddInputSchema.safeParse({
        conversationId: CONVERSATION_ID,
        body: "note",
        message_type: "comment",
      }).success,
    ).toBe(false);
    expect(
      conversationStateSetInputSchema.safeParse({
        conversationId: CONVERSATION_ID,
        state: "open",
        admin_id: "evil",
      }).success,
    ).toBe(false);
  });

  it("denies note add when notes are disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      notesEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
      arguments: { conversationId: CONVERSATION_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getAdminNotePostCount()).toBe(0);
  });

  it("denies state set when status updates are disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      statusEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_STATE_SET_TOOL,
      arguments: { conversationId: CONVERSATION_ID, state: "closed" },
    });
    expectForbidden(result);
    expect(mock.getStatePutCount()).toBe(0);
  });

  it("denies mutations without host write approval", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      hostWritesApproved: false,
    });
    const note = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
      arguments: { conversationId: CONVERSATION_ID, body: "internal" },
    });
    expectForbidden(note);
    expect(mock.getAdminNotePostCount()).toBe(0);
    expect(mock.getStatePutCount()).toBe(0);
  });

  it("denies mutations without resource allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedResourceIds: undefined,
    });
    const result = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
      arguments: { conversationId: CONVERSATION_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getAdminNotePostCount()).toBe(0);
  });

  it("denies mutations for conversations outside the allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedResourceIds: ["conv_other"],
    });
    const result = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_STATE_SET_TOOL,
      arguments: { conversationId: CONVERSATION_ID, state: "closed" },
    });
    expectForbidden(result);
    expect(mock.getStatePutCount()).toBe(0);
  });

  it("rejects invalid conversation states", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_STATE_SET_TOOL,
      arguments: { conversationId: CONVERSATION_ID, state: "snoozed" },
    });
    expectForbidden(result);
    expect(mock.getStatePutCount()).toBe(0);
  });

  it("authorized admin note uses message_type note", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
      arguments: { conversationId: CONVERSATION_ID, body: "internal only" },
    });
    expect(result.isError).not.toBe(true);
    expect(mock.getAdminNotePostCount()).toBe(1);
    const body = mock.getLastAdminNoteBody() as {
      message_type?: string;
      type?: string;
    };
    expect(body.message_type).toBe("note");
    expect(body.type).toBe("admin");
  });

  it("maps ambiguous mutation failures", () => {
    const mapped = mapIntercomError(
      { kind: "http", status: 502 },
      { ambiguousWrite: true },
    );
    expect(mapped.message).toMatch(/ambiguous/i);
  });
});
