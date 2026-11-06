import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GMAIL_MESSAGE_LIST_TOOL,
  GMAIL_PROFILE_GET_TOOL,
} from "../src/constants.js";
import { createGmailConnector } from "../src/connector.js";
import type { GmailConfig } from "../src/schemas.js";
import { startMockGmailHttpServer } from "./fixtures/mock-gmail-http-server.js";
import { createTestGmailClient } from "./helpers/test-env.js";

describe("MCP compatibility (gmail)", () => {
  const clients: Client[] = [];

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
  });

  const readOnlyConfig: GmailConfig = {
    requestTimeoutMs: 5_000,
    useDomainDelegation: false,
    draftsEnabled: false,
    sendEnabled: false,
    hostSendApproved: false,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  };

  it("supports tools/list and tools/call", async () => {
    const server = await startMockGmailHttpServer();
    const client = createTestGmailClient(server);
    const connector = createGmailConnector({ client, config: readOnlyConfig });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([GMAIL_PROFILE_GET_TOOL]));
    expect(names.length).toBe(10);

    const result = await mcpClient.callTool({
      name: GMAIL_MESSAGE_LIST_TOOL,
      arguments: {},
    });
    expect(result.isError).not.toBe(true);

    await server.close();
  });
});
