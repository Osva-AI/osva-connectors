import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  CONFLUENCE_PAGE_GET_TOOL,
  CONFLUENCE_SPACE_LIST_TOOL,
} from "../src/constants.js";
import { createConfluenceConnector } from "../src/connector.js";
import { confluenceConfigSchema } from "../src/schemas.js";
import {
  FAKE_CONFLUENCE_ACCESS_TOKEN,
  MOCK_PAGE_ID,
  startMockConfluenceHttpServer,
  type MockConfluenceHttpServer,
} from "./fixtures/mock-confluence-http-server.js";
import { createTestConfluenceClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockConfluenceHttpServer | undefined;

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
    server = await startMockConfluenceHttpServer();
    const client = createTestConfluenceClient(server);
    const config = confluenceConfigSchema.parse({
      apiBaseV2: server.apiOriginV2,
      apiBaseRest: server.apiOriginRest,
      authorizationHeader: `Bearer ${FAKE_CONFLUENCE_ACCESS_TOKEN}`,
      credentialForRedaction: FAKE_CONFLUENCE_ACCESS_TOKEN,
      writeEnabled: false,
      hostWritesApproved: false,
    });
    const connector = createConfluenceConnector({ client, config });
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
      expect.arrayContaining([
        CONFLUENCE_SPACE_LIST_TOOL,
        CONFLUENCE_PAGE_GET_TOOL,
      ]),
    );
    expect(names.length).toBe(8);

    const result = await mcpClient.callTool({
      name: CONFLUENCE_PAGE_GET_TOOL,
      arguments: { pageId: MOCK_PAGE_ID },
    });
    expect(result.isError).not.toBe(true);
  });
});
