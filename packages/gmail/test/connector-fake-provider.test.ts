import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GMAIL_LABEL_LIST_TOOL,
  GMAIL_MESSAGE_LIST_TOOL,
  GMAIL_PROFILE_GET_TOOL,
} from "../src/constants.js";
import { createGmailConnector } from "../src/connector.js";
import type { GmailConfig } from "../src/schemas.js";
import { startMockGmailHttpServer } from "./fixtures/mock-gmail-http-server.js";
import {
  createTestGmailClient,
  FAKE_GMAIL_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("Gmail connector (fake HTTP provider)", () => {
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

  async function createLinkedClient(config: GmailConfig) {
    const server = await startMockGmailHttpServer();
    const client = createTestGmailClient(server);
    const connector = createGmailConnector({
      client,
      config,
      accessTokenForRedaction: FAKE_GMAIL_ACCESS_TOKEN,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("profile.get and message.list against fake provider", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);

    const profile = await mcpClient.callTool({
      name: GMAIL_PROFILE_GET_TOOL,
      arguments: {},
    });
    expect(profile.isError).not.toBe(true);

    const listed = await mcpClient.callTool({
      name: GMAIL_MESSAGE_LIST_TOOL,
      arguments: {},
    });
    expect(listed.isError).not.toBe(true);

    await server.close();
  });

  it("rejects send when disabled", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);

    const result = await mcpClient.callTool({
      name: "gmail.message.send",
      arguments: {
        message: {
          to: ["a@test.com"],
          subject: "x",
          bodyPlain: "y",
        },
      },
    });
    expect(result.isError).toBe(true);

    await server.close();
  });

  it("lists labels", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);
    const r = await mcpClient.callTool({
      name: GMAIL_LABEL_LIST_TOOL,
      arguments: {},
    });
    expect(r.isError).not.toBe(true);
    await server.close();
  });
});
