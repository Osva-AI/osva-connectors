import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { createSalesforceConnector } from "../src/connector.js";
import {
  startMockSalesforceHttpServer,
  type MockSalesforceHttpServer,
} from "./fixtures/mock-salesforce-http-server.js";
import {
  createTestSalesforceClient,
  createTestSalesforceConfig,
} from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  "salesforce.account.list",
  "salesforce.account.get",
  "salesforce.contact.list",
  "salesforce.contact.get",
  "salesforce.opportunity.list",
  "salesforce.opportunity.get",
  "salesforce.opportunity.stage.list",
  "salesforce.opportunity.stage.set",
  "salesforce.task.create",
];

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockSalesforceHttpServer | undefined;

  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map((c) => c.close().catch(() => undefined)),
    );
    await server?.close();
    server = undefined;
  });

  it("exposes exactly nine tools", async () => {
    server = await startMockSalesforceHttpServer();
    const connector = createSalesforceConnector({
      client: createTestSalesforceClient(server),
      config: createTestSalesforceConfig({
        instanceUrl: server.instanceUrl,
        pinnedOrigin: server.pinnedOrigin,
        apiDataBaseUrl: server.apiDataBaseUrl,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "t", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(st);
    await mcpClient.connect(ct);
    const names = (await mcpClient.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
