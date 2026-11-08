import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  PIPEDRIVE_DEAL_GET_TOOL,
  PIPEDRIVE_DEAL_LIST_TOOL,
  PIPEDRIVE_DEAL_STAGE_SET_TOOL,
} from "../src/constants.js";
import { createPipedriveConnector } from "../src/connector.js";
import {
  startMockPipedriveHttpServer,
  type MockPipedriveHttpServer,
} from "./fixtures/mock-pipedrive-http-server.js";
import {
  createTestPipedriveClient,
  createTestPipedriveConfig,
} from "./helpers/test-env.js";

describe("Pipedrive connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockPipedriveHttpServer | undefined;

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
    configOverrides?: Parameters<typeof createTestPipedriveConfig>[0],
  ) {
    server = await startMockPipedriveHttpServer();
    const client = createTestPipedriveClient(server);
    const connector = createPipedriveConnector({
      client,
      config: createTestPipedriveConfig({
        apiBaseUrl: server.apiBaseUrl,
        pinnedOrigin: server.pinnedOrigin,
        ...configOverrides,
      }),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "Pipedrive-fake", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("lists and gets deals", async () => {
    const mcpClient = await createLinkedClient();
    const list = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_LIST_TOOL,
      arguments: { limit: 25 },
    });
    expect(list.isError).not.toBe(true);
    const get = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_GET_TOOL,
      arguments: { dealId: 1001 },
    });
    expect(get.isError).not.toBe(true);
  });

  it("blocks stage mutations without gates", async () => {
    const mcpClient = await createLinkedClient({ allowedDealIds: [1001] });
    const result = await mcpClient.callTool({
      name: PIPEDRIVE_DEAL_STAGE_SET_TOOL,
      arguments: { dealId: 1001, targetStageId: 2 },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("FORBIDDEN");
  });
});
