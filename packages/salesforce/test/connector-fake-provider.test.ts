import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";
import {
  SALESFORCE_ACCOUNT_GET_TOOL,
  SALESFORCE_ACCOUNT_LIST_TOOL,
  SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL,
} from "../src/constants.js";
import { createSalesforceConnector } from "../src/connector.js";
import {
  FIXTURE_ACCOUNT_ID,
  FIXTURE_OPPORTUNITY_ID,
  startMockSalesforceHttpServer,
  type MockSalesforceHttpServer,
} from "./fixtures/mock-salesforce-http-server.js";
import {
  createTestSalesforceClient,
  createTestSalesforceConfig,
} from "./helpers/test-env.js";

describe("Salesforce connector (fake HTTP provider)", () => {
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
    const mcpClient = new Client({ name: "Salesforce-fake", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("lists and gets accounts", async () => {
    const mcpClient = await createLinkedClient();
    const list = await mcpClient.callTool({
      name: SALESFORCE_ACCOUNT_LIST_TOOL,
      arguments: { perPage: 25 },
    });
    expect(list.isError).not.toBe(true);
    const get = await mcpClient.callTool({
      name: SALESFORCE_ACCOUNT_GET_TOOL,
      arguments: { accountId: FIXTURE_ACCOUNT_ID },
    });
    expect(get.isError).not.toBe(true);
  });

  it("blocks stage mutations without gates", async () => {
    const mcpClient = await createLinkedClient({
      allowedOpportunityIds: [FIXTURE_OPPORTUNITY_ID],
    });
    const result = await mcpClient.callTool({
      name: SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL,
      arguments: {
        opportunityId: FIXTURE_OPPORTUNITY_ID,
        targetStage: "Prospecting",
      },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("FORBIDDEN");
  });
});
