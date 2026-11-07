import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  JIRA_ISSUE_CREATE_TOOL,
  JIRA_ISSUE_SEARCH_TOOL,
  JIRA_PROJECT_LIST_TOOL,
} from "../src/constants.js";
import { createJiraConnector } from "../src/connector.js";
import { jiraConfigSchema } from "../src/schemas.js";
import {
  MOCK_PROJECT_KEY,
  startMockJiraHttpServer,
  type MockJiraHttpServer,
} from "./fixtures/mock-jira-http-server.js";
import { createTestJiraClient } from "./helpers/test-env.js";

describe("Jira connector (fake provider)", () => {
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

  async function createLinkedClient(options?: {
    writeEnabled?: boolean;
    allowedProjectKeys?: string[] | undefined;
  }) {
    server = await startMockJiraHttpServer();
    const client = createTestJiraClient(server);
    const config = jiraConfigSchema.parse({
      apiBasePath: server.apiBasePath,
      authorizationHeader: "Basic test",
      credentialForRedaction: "test",
      writeEnabled: options?.writeEnabled ?? false,
      hostWritesApproved: options?.writeEnabled ?? false,
      ...(options?.allowedProjectKeys !== undefined
        ? { allowedProjectKeys: options.allowedProjectKeys }
        : {}),
    });
    const connector = createJiraConnector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("searches issues via POST /search/jql", async () => {
    const { mcpClient, server } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: JIRA_ISSUE_SEARCH_TOOL,
      arguments: { jql: "order by created DESC", maxResults: 10 },
    });
    expect(result.isError).not.toBe(true);
    expect(server!.getLastSearchJqlPath()).toBe(true);
  });

  it("filters project list by allowlist", async () => {
    const { mcpClient } = await createLinkedClient({
      allowedProjectKeys: [MOCK_PROJECT_KEY],
    });
    const result = await mcpClient.callTool({
      name: JIRA_PROJECT_LIST_TOOL,
      arguments: { maxResults: 50 },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content?.[0];
    if (text?.type === "text") {
      const parsed = JSON.parse(text.text) as { projects: { key: string }[] };
      expect(parsed.projects.every((p) => p.key === MOCK_PROJECT_KEY)).toBe(
        true,
      );
    }
  });

  it("denies mutations when write flags are off", async () => {
    const { mcpClient } = await createLinkedClient({ writeEnabled: false });
    const result = await mcpClient.callTool({
      name: JIRA_ISSUE_CREATE_TOOL,
      arguments: {
        projectKey: MOCK_PROJECT_KEY,
        issueTypeId: "10001",
        summary: "New task",
      },
    });
    expect(result.isError).toBe(true);
  });

  it("maps unauthorized provider responses", async () => {
    server = await startMockJiraHttpServer();
    server.setMode("unauthorized");
    const client = createTestJiraClient(server);
    const config = jiraConfigSchema.parse({
      apiBasePath: server.apiBasePath,
      authorizationHeader: "Basic test",
      credentialForRedaction: "test",
    });
    const connector = createJiraConnector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: JIRA_ISSUE_SEARCH_TOOL,
      arguments: { jql: "order by created" },
    });
    expect(result.isError).toBe(true);
  });
});
