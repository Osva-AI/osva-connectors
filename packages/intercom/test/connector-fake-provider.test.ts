import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  INTERCOM_CONVERSATION_GET_TOOL,
  INTERCOM_CONVERSATION_LIST_TOOL,
  INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
} from "../src/constants.js";
import { createIntercomConnector } from "../src/connector.js";
import {
  startMockIntercomHttpServer,
  type MockIntercomHttpServer,
} from "./fixtures/mock-intercom-http-server.js";
import {
  createTestIntercomClient,
  createTestIntercomConfig,
} from "./helpers/test-env.js";

describe("Intercom connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockIntercomHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestIntercomConfig>[0],
  ) {
    server = await startMockIntercomHttpServer();
    const client = createTestIntercomClient(server);
    const connector = createIntercomConnector({
      client,
      config: createTestIntercomConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "intercom-fake", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("lists and gets conversations", async () => {
    const mcpClient = await createLinkedClient({
      allowedResourceIds: ["conv_fixture_1001"],
    });
    const list = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_LIST_TOOL,
      arguments: { page: 1 },
    });
    expect(list.isError).not.toBe(true);
    const get = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_GET_TOOL,
      arguments: { conversationId: "conv_fixture_1001" },
    });
    expect(get.isError).not.toBe(true);
  });

  it("blocks note mutations without gates", async () => {
    const mcpClient = await createLinkedClient({
      allowedResourceIds: ["conv_fixture_1001"],
    });
    const result = await mcpClient.callTool({
      name: INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
      arguments: { conversationId: "conv_fixture_1001", body: "note" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("FORBIDDEN");
  });
});
