import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import {
  ConnectorSdkError,
  createMcpServerFromConnector,
} from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  OUTLOOK_CALENDAR_LIST_TOOL,
  OUTLOOK_MAIL_FOLDER_LIST_TOOL,
  OUTLOOK_MESSAGE_LIST_TOOL,
  OUTLOOK_MESSAGE_SEND_TOOL,
} from "../src/constants.js";
import { createOutlookConnector } from "../src/connector.js";
import { assertAllowedGraphUrl } from "../src/graph-pagination.js";
import type { OutlookConfig } from "../src/schemas.js";
import { assertRecipientsAllowedByHostPolicy } from "../src/send-policy.js";
import {
  MOCK_MAIL_FOLDER_ID,
  startMockGraphHttpServer,
} from "./fixtures/mock-graph-http-server.js";
import {
  createTestOutlookClient,
  FAKE_OUTLOOK_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("Outlook connector (fake HTTP provider)", () => {
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

  const readOnlyConfig: OutlookConfig = {
    accessToken: FAKE_OUTLOOK_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
    sendEnabled: false,
    hostSendApproved: false,
    writeEnabled: false,
    hostWritesApproved: false,
  };

  async function createLinkedClient(config: OutlookConfig) {
    const server = await startMockGraphHttpServer();
    const client = createTestOutlookClient(server);
    const connector = createOutlookConnector({
      client,
      config,
      accessTokenForRedaction: FAKE_OUTLOOK_ACCESS_TOKEN,
      graphApiHost: server.graphApiOrigin,
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

  it("mailFolder.list returns validated nextLink", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);
    const listed = await mcpClient.callTool({
      name: OUTLOOK_MAIL_FOLDER_LIST_TOOL,
      arguments: {},
    });
    expect(listed.isError).not.toBe(true);
    const block = listed.content?.[0];
    expect(block?.type).toBe("text");
    if (block?.type !== "text") {
      return;
    }
    const payload = JSON.parse(block.text) as { nextLink?: string };
    expect(payload.nextLink).toBeDefined();
    assertAllowedGraphUrl(payload.nextLink ?? "", server.graphApiOrigin);
    await server.close();
  });

  it("rejects cross-resource nextLink on calendar list", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);
    const result = await mcpClient.callTool({
      name: OUTLOOK_CALENDAR_LIST_TOOL,
      arguments: {
        nextLink:
          "https://graph.microsoft.com/v1.0/me/mailFolders?$skiptoken=x",
      },
    });
    expect(result.isError).toBe(true);
    await server.close();
  });

  it("rejects nextLink to foreign host", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);
    const result = await mcpClient.callTool({
      name: OUTLOOK_MAIL_FOLDER_LIST_TOOL,
      arguments: {
        nextLink: "https://evil.example/v1.0/me/mailFolders",
      },
    });
    expect(result.isError).toBe(true);
    await server.close();
  });

  it("message.list against fake provider", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);
    const listed = await mcpClient.callTool({
      name: OUTLOOK_MESSAGE_LIST_TOOL,
      arguments: { mailFolderId: MOCK_MAIL_FOLDER_ID },
    });
    expect(listed.isError).not.toBe(true);
    await server.close();
  });

  it("rejects send when disabled by default", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);
    const result = await mcpClient.callTool({
      name: OUTLOOK_MESSAGE_SEND_TOOL,
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

  it("recipient allowlist blocks unlisted addresses", () => {
    const sendConfig: OutlookConfig = {
      ...readOnlyConfig,
      sendEnabled: true,
      hostSendApproved: true,
      allowedRecipients: ["allowed@example.com"],
    };
    expect(() =>
      assertRecipientsAllowedByHostPolicy(
        ["forbidden@example.com"],
        sendConfig,
      ),
    ).toThrow(ConnectorSdkError);
  });
});
