import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  ZOHO_DEAL_NOTE_ADD_TOOL,
  ZOHO_DEAL_STAGE_SET_TOOL,
} from "../src/constants.js";
import { createZohoConnector } from "../src/connector.js";
import { mapZohoError } from "../src/map-zoho-error.js";
import { buildZohoDealNoteBody } from "../src/mutation-allowlist.js";
import {
  dealNoteAddInputSchema,
  dealStageSetInputSchema,
} from "../src/tool-schemas.js";
import {
  FIXTURE_DEAL_ID,
  startMockZohoHttpServer,
  type MockZohoHttpServer,
} from "./fixtures/mock-zoho-http-server.js";
import {
  createTestZohoClient,
  createTestZohoConfig,
} from "./helpers/test-env.js";

const AUTHORIZED = {
  notesEnabled: true,
  stageUpdatesEnabled: true,
  hostWritesApproved: true,
  allowedDealIds: [FIXTURE_DEAL_ID],
  allowedTargetStages: ["Qualification", "Closed Won"],
};

describe("Zoho CRM mutation safeguards", () => {
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
    const mcpClient = new Client({
      name: "zoho-mutations",
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

  it("rejects portal share and mutation injection fields in tool schemas", () => {
    expect(
      dealNoteAddInputSchema.safeParse({
        dealId: FIXTURE_DEAL_ID,
        body: "note",
        $is_shared_to_client: true,
      }).success,
    ).toBe(false);
    expect(
      dealNoteAddInputSchema.safeParse({
        dealId: FIXTURE_DEAL_ID,
        body: "note",
        Note_Content: "evil",
      }).success,
    ).toBe(false);
    expect(
      dealStageSetInputSchema.safeParse({
        dealId: FIXTURE_DEAL_ID,
        stage: "Closed Won",
        Stage: "evil",
      }).success,
    ).toBe(false);
    expect(
      dealNoteAddInputSchema.safeParse({
        dealId: 9001000000001001,
        body: "note",
      }).success,
    ).toBe(false);
  });

  it("buildZohoDealNoteBody always sets portal share false", () => {
    const body = buildZohoDealNoteBody(FIXTURE_DEAL_ID, "internal note");
    const row = (body.data as Record<string, unknown>[])[0];
    expect(row?.$is_shared_to_client).toBe(false);
  });

  it("denies note add when notes are disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      notesEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_NOTE_ADD_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getDealNotePostCount()).toBe(0);
  });

  it("denies stage set when status updates are disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      stageUpdatesEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID, stage: "Closed Won" },
    });
    expectForbidden(result);
    expect(mock.getDealStagePutCount()).toBe(0);
  });

  it("denies mutations without host write approval", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      hostWritesApproved: false,
    });
    const note = await mcpClient.callTool({
      name: ZOHO_DEAL_NOTE_ADD_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID, body: "internal" },
    });
    expectForbidden(note);
    expect(mock.getDealNotePostCount()).toBe(0);
    expect(mock.getDealStagePutCount()).toBe(0);
  });

  it("denies mutations without resource allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedDealIds: undefined,
    });
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_NOTE_ADD_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID, body: "internal" },
    });
    expectForbidden(result);
    expect(mock.getDealNotePostCount()).toBe(0);
  });

  it("denies mutations for deals outside the allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedDealIds: ["9001999999999999"],
    });
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID, stage: "Closed Won" },
    });
    expectForbidden(result);
    expect(mock.getDealStagePutCount()).toBe(0);
  });

  it("rejects invalid deal stages", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID, stage: "Negotiation" },
    });
    expectForbidden(result);
    expect(mock.getDealStagePutCount()).toBe(0);
  });

  it("authorized deal note never shares to client portal", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: ZOHO_DEAL_NOTE_ADD_TOOL,
      arguments: { dealId: FIXTURE_DEAL_ID, body: "internal only" },
    });
    expect(result.isError).not.toBe(true);
    expect(mock.getDealNotePostCount()).toBe(1);
    const body = mock.getLastDealNoteBody() as {
      data?: Record<string, unknown>[];
    };
    const row = body.data?.[0];
    expect(row?.$is_shared_to_client).toBe(false);
    expect(row?.Note_Content).toBe("internal only");
  });

  it("maps ambiguous mutation failures", () => {
    const mapped = mapZohoError(
      { kind: "http", status: 502 },
      { ambiguousWrite: true },
    );
    expect(mapped.message).toMatch(/ambiguous/i);
  });
});
