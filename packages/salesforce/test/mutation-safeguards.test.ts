import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";
import {
  SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL,
  SALESFORCE_TASK_CREATE_TOOL,
} from "../src/constants.js";
import { createSalesforceConnector } from "../src/connector.js";
import { mapSalesforceError } from "../src/map-salesforce-error.js";
import {
  opportunityStageSetInputSchema,
  taskCreateInputSchema,
} from "../src/tool-schemas.js";
import {
  FIXTURE_OPPORTUNITY_ID,
  startMockSalesforceHttpServer,
  type MockSalesforceHttpServer,
} from "./fixtures/mock-salesforce-http-server.js";
import {
  createTestSalesforceClient,
  createTestSalesforceConfig,
} from "./helpers/test-env.js";

const AUTHORIZED = {
  stageUpdatesEnabled: true,
  tasksEnabled: true,
  hostWritesApproved: true,
  allowedOpportunityIds: [FIXTURE_OPPORTUNITY_ID],
  allowedTaskParentIds: [FIXTURE_OPPORTUNITY_ID],
};

describe("Salesforce mutation safeguards", () => {
  const clients: Client[] = [];
  let server: MockSalesforceHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestSalesforceConfig>[0],
  ) {
    server = await startMockSalesforceHttpServer();
    const client = createTestSalesforceClient(server);
    const connector = createSalesforceConnector({
      client,
      config: createTestSalesforceConfig({
        instanceUrl: server.instanceUrl,
        pinnedOrigin: server.pinnedOrigin,
        apiDataBaseUrl: server.apiDataBaseUrl,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({
      name: "salesforce-mutations",
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

  it("rejects host approval fields in tool schemas", () => {
    expect(
      opportunityStageSetInputSchema.safeParse({
        opportunityId: FIXTURE_OPPORTUNITY_ID,
        targetStage: "Prospecting",
        hostWritesApproved: true,
      }).success,
    ).toBe(false);
    expect(
      taskCreateInputSchema.safeParse({
        subject: "Follow up",
        relatedRecordType: "Opportunity",
        relatedRecordId: FIXTURE_OPPORTUNITY_ID,
        OwnerId: "005",
      }).success,
    ).toBe(false);
  });

  it("denies stage set when disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      stageUpdatesEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL,
      arguments: {
        opportunityId: FIXTURE_OPPORTUNITY_ID,
        targetStage: "Prospecting",
      },
    });
    expectForbidden(result);
    expect(mock.getStagePatchCount()).toBe(0);
  });

  it("denies task create when disabled", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      tasksEnabled: false,
    });
    const result = await mcpClient.callTool({
      name: SALESFORCE_TASK_CREATE_TOOL,
      arguments: {
        subject: "Call",
        relatedRecordType: "Opportunity",
        relatedRecordId: FIXTURE_OPPORTUNITY_ID,
      },
    });
    expectForbidden(result);
    expect(mock.getTaskPostCount()).toBe(0);
  });

  it("denies mutations without host write approval", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      hostWritesApproved: false,
    });
    const result = await mcpClient.callTool({
      name: SALESFORCE_TASK_CREATE_TOOL,
      arguments: {
        subject: "Call",
        relatedRecordType: "Opportunity",
        relatedRecordId: FIXTURE_OPPORTUNITY_ID,
      },
    });
    expectForbidden(result);
    expect(mock.getTaskPostCount()).toBe(0);
  });

  it("denies mutations without allowlist configuration", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedOpportunityIds: undefined,
    });
    const result = await mcpClient.callTool({
      name: SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL,
      arguments: {
        opportunityId: FIXTURE_OPPORTUNITY_ID,
        targetStage: "Prospecting",
      },
    });
    expectForbidden(result);
    expect(mock.getStagePatchCount()).toBe(0);
  });

  it("denies opportunities outside the allowlist", async () => {
    const { mcpClient, server: mock } = await createLinkedClient({
      ...AUTHORIZED,
      allowedTaskParentIds: ["006000000000099AAA"],
    });
    const result = await mcpClient.callTool({
      name: SALESFORCE_TASK_CREATE_TOOL,
      arguments: {
        subject: "Call",
        relatedRecordType: "Opportunity",
        relatedRecordId: FIXTURE_OPPORTUNITY_ID,
      },
    });
    expectForbidden(result);
    expect(mock.getTaskPostCount()).toBe(0);
  });

  it("authorized stage patch sends StageName only", async () => {
    const { mcpClient, server: mock } = await createLinkedClient(AUTHORIZED);
    const result = await mcpClient.callTool({
      name: SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL,
      arguments: {
        opportunityId: FIXTURE_OPPORTUNITY_ID,
        targetStage: "Prospecting",
      },
    });
    expect(result.isError).not.toBe(true);
    expect(mock.getStagePatchCount()).toBe(1);
    const body = mock.getLastStagePatchBody() as { StageName?: string };
    expect(body.StageName).toBe("Prospecting");
    expect(Object.keys(body)).toEqual(["StageName"]);
  });

  it("maps ambiguous mutation failures", () => {
    const mapped = mapSalesforceError(
      { kind: "http", status: 504 },
      { ambiguousWrite: true },
    );
    expect(mapped.message).toMatch(/ambiguous/i);
  });
});
