import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  EXA_ANSWER_TOOL,
  EXA_CONTENTS_GET_TOOL,
  EXA_SEARCH_TOOL,
} from "../src/constants.js";
import { createExaConnector } from "../src/connector.js";
import {
  startMockExaHttpServer,
  type MockExaHttpServer,
} from "./fixtures/mock-exa-http-server.js";
import { createTestExaClient, FAKE_EXA_API_KEY } from "./helpers/test-env.js";

describe("MCP compatibility (exa)", () => {
  const clients: Client[] = [];
  let server: MockExaHttpServer | undefined;

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
    server = await startMockExaHttpServer();
    const client = createTestExaClient(server);
    const connector = createExaConnector({
      client,
      apiKeyForRedaction: FAKE_EXA_API_KEY,
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
    expect(names).toEqual([
      EXA_SEARCH_TOOL,
      EXA_CONTENTS_GET_TOOL,
      EXA_ANSWER_TOOL,
    ]);

    const search = await mcpClient.callTool({
      name: EXA_SEARCH_TOOL,
      arguments: { query: "fixture query" },
    });
    expect(search.isError).not.toBe(true);
  });
});
