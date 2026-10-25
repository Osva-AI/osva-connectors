import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GSC_PROPERTY_LIST_TOOL,
  GSC_PERFORMANCE_QUERY_TOOL,
} from "../src/constants.js";
import { createGscConnector } from "../src/connector.js";
import {
  MOCK_SITE_URL,
  startMockGscHttpServer,
  type MockGscHttpServer,
} from "./fixtures/mock-gsc-http-server.js";
import { createTestGscClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockGscHttpServer | undefined;

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
    server = await startMockGscHttpServer();
    const client = createTestGscClient(server);
    const connector = createGscConnector({
      client,
      defaultSiteUrl: MOCK_SITE_URL,
    });
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
        GSC_PROPERTY_LIST_TOOL,
        GSC_PERFORMANCE_QUERY_TOOL,
      ]),
    );
    expect(names.length).toBe(8);

    const result = await mcpClient.callTool({
      name: GSC_PROPERTY_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
  });
});
