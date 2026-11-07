import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  JIRA_ISSUE_GET_TOOL,
  JIRA_PROJECT_LIST_TOOL,
} from "../src/constants.js";
import { createJiraConnector } from "../src/connector.js";
import { jiraConfigSchema } from "../src/schemas.js";
import {
  MOCK_ISSUE_KEY,
  startMockJiraHttpServer,
  type MockJiraHttpServer,
} from "./fixtures/mock-jira-http-server.js";
import { createTestJiraClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockJiraHttpServer | undefined;

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

  async function createLinkedClient() {
    server = await startMockJiraHttpServer();
    const client = createTestJiraClient(server);
    const config = jiraConfigSchema.parse({
      apiBasePath: server.apiBasePath,
      authorizationHeader: "Basic test",
      credentialForRedaction: "test",
      writeEnabled: false,
      hostWritesApproved: false,
    });
    const connector = createJiraConnector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("supports tools/list and tools/call", async () => {
    const mcpClient = await createLinkedClient();
    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([JIRA_PROJECT_LIST_TOOL, JIRA_ISSUE_GET_TOOL]),
    );
    expect(names.length).toBe(9);

    const result = await mcpClient.callTool({
      name: JIRA_ISSUE_GET_TOOL,
      arguments: { issueKey: MOCK_ISSUE_KEY },
    });
    expect(result.isError).not.toBe(true);
  });
});
