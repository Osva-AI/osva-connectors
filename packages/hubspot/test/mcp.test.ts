import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  HUBSPOT_CONTACT_LIST_TOOL,
  HUBSPOT_CONTACT_GET_TOOL,
} from "../src/constants.js";
import { createHubspotConnector } from "../src/connector.js";
import {
  startMockHubspotHttpServer,
  type MockHubspotHttpServer,
} from "./fixtures/mock-hubspot-http-server.js";
import { createTestHubspotClient } from "./helpers/test-env.js";

describe("MCP compatibility", () => {
  const clients: Client[] = [];
  let server: MockHubspotHttpServer | undefined;

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
    server = await startMockHubspotHttpServer();
    const client = createTestHubspotClient(server);
    const connector = createHubspotConnector({ client });
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
        HUBSPOT_CONTACT_LIST_TOOL,
        HUBSPOT_CONTACT_GET_TOOL,
      ]),
    );
    expect(names.length).toBe(10);

    const result = await mcpClient.callTool({
      name: HUBSPOT_CONTACT_LIST_TOOL,
      arguments: { limit: 5 },
    });
    expect(result.isError).not.toBe(true);
  });
});
