import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  AMPLITUDE_EVENT_LIST_TOOL,
  AMPLITUDE_USER_ACTIVE_TOOL,
} from "../src/constants.js";
import { createAmplitudeConnector } from "../src/connector.js";
import {
  startMockAmplitudeHttpServer,
  type MockAmplitudeHttpServer,
} from "./fixtures/mock-amplitude-http-server.js";
import { createTestAmplitudeClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockAmplitudeHttpServer | undefined;

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
    server = await startMockAmplitudeHttpServer();
    const client = createTestAmplitudeClient(server);
    const connector = createAmplitudeConnector({ client });
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
        AMPLITUDE_EVENT_LIST_TOOL,
        AMPLITUDE_USER_ACTIVE_TOOL,
      ]),
    );
    expect(names.length).toBe(7);

    const result = await mcpClient.callTool({
      name: AMPLITUDE_EVENT_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
  });
});
