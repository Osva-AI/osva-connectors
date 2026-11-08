import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { PIPEDRIVE_DEAL_STAGE_SET_TOOL } from "../src/constants.js";
import { createPipedriveConnector } from "../src/connector.js";
import { mapPipedriveError } from "../src/map-pipedrive-error.js";
import { dealStageSetInputSchema } from "../src/tool-schemas.js";
import {
  startMockPipedriveHttpServer,
  type MockPipedriveHttpServer,
} from "./fixtures/mock-pipedrive-http-server.js";
import {
  createTestPipedriveClient,
  createTestPipedriveConfig,
} from "./helpers/test-env.js";

const DEAL_ID = 1001;
const STAGE_ID = 2;
const AUTHORIZED = {
  stageUpdatesEnabled: true,
  hostWritesApproved: true,
  allowedDealIds: [DEAL_ID],
};

describe("Pipedrive mutation safeguards", () => {
  const clients: Client[] = [];
  let server: MockPipedriveHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestPipedriveConfig>[0],
  ) {
    server = await startMockPipedriveHttpServer();
    const client = createTestPipedriveClient(server);
    const connector = createPipedriveConnector({
      client,
      config: createTestPipedriveConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({
      name: "pipedrive-mutations",
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

  it("rejects extra fields in deal stage set schema", () => {
    expect(
      dealStageSetInputSchema.safeParse({
        dealId: DEAL_ID,
        targetStageId: STAGE_ID,
        title: "injected",
      }).success,
    ).toBe(false);
    expect(
      dealStageSetInputSchema.safeParse({
        dealId: DEAL_ID,
        targetStageId: STAGE_ID,
        hostWritesApproved: true,
      }).success,
    ).toBe(false);
  });

  it("denies stage set when disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      stageUpdatesEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: DEAL_ID, targetStageId: STAGE_ID },
    });
    expectForbidden(result);
    expect(mock.getStagePatchCount()).toBe(0);
  });

  it("denies mutations without host write approval", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      hostWritesApproved: false,
    });
    const result = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: DEAL_ID, targetStageId: STAGE_ID },
    });
    expectForbidden(result);
    expect(mock.getStagePatchCount()).toBe(0);
  });

  it("denies mutations without allowlist configuration", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedDealIds: undefined,
    });
    const result = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: DEAL_ID, targetStageId: STAGE_ID },
    });
    expectForbidden(result);
    expect(mock.getStagePatchCount()).toBe(0);
  });

  it("denies deals outside the allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedDealIds: [4242],
    });
    const result = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: DEAL_ID, targetStageId: STAGE_ID },
    });
    expectForbidden(result);
    expect(mock.getStagePatchCount()).toBe(0);
  });

  it("rejects disallowed target stage ids", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedStageIds: [99],
    });
    const result = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: DEAL_ID, targetStageId: STAGE_ID },
    });
    expectForbidden(result);
    expect(mock.getStagePatchCount()).toBe(0);
  });

  it("authorized stage set posts stage_id only", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: DEAL_ID, targetStageId: STAGE_ID },
    });
    expect(result.isError).not.toBe(true);
    expect(mock.getStagePatchCount()).toBe(1);
    const body = mock.getLastStagePatchBody() as { stage_id?: number };
    expect(body.stage_id).toBe(STAGE_ID);
    expect(Object.keys(body)).toEqual(["stage_id"]);
  });

  it("maps ambiguous mutation failures", () => {
    const mapped = mapPipedriveError(
      { kind: "http", status: 504 },
      { ambiguousWrite: true },
    );
    expect(mapped.message).toMatch(/ambiguous/i);
  });
});
