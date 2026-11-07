import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  LINEAR_ISSUE_GET_TOOL,
  LINEAR_VIEWER_GET_TOOL,
} from "../src/constants.js";
import { createLinearConnector } from "../src/connector.js";
import { linearConfigSchema } from "../src/schemas.js";
import {
  MOCK_ISSUE_ID,
  startMockLinearGraphqlServer,
  type MockLinearGraphqlServer,
} from "./fixtures/mock-linear-graphql-server.js";
import {
  createTestLinearClient,
  FAKE_LINEAR_API_KEY,
} from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockLinearGraphqlServer | undefined;

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
    server = await startMockLinearGraphqlServer();
    const client = createTestLinearClient(server);
    const config = linearConfigSchema.parse({
      authorizationHeader: FAKE_LINEAR_API_KEY,
      credentialForRedaction: FAKE_LINEAR_API_KEY,
      writeEnabled: false,
      hostMutationsApproved: false,
    });
    const connector = createLinearConnector({ client, config });
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
      expect.arrayContaining([LINEAR_VIEWER_GET_TOOL, LINEAR_ISSUE_GET_TOOL]),
    );
    expect(names.length).toBe(10);

    const result = await mcpClient.callTool({
      name: LINEAR_ISSUE_GET_TOOL,
      arguments: { issueId: MOCK_ISSUE_ID },
    });
    expect(result.isError).not.toBe(true);
  });
});
