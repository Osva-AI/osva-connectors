import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { WHATSAPP_TEMPLATE_SEND_TOOL } from "../src/constants.js";
import { createWhatsAppConnector } from "../src/connector.js";
import { mapWhatsAppError } from "../src/map-whatsapp-error.js";
import {
  MOCK_RECIPIENT,
  startMockWhatsAppHttpServer,
  type MockWhatsAppHttpServer,
} from "./fixtures/mock-whatsapp-http-server.js";
import {
  createTestWhatsAppClient,
  createTestWhatsAppConfig,
} from "./helpers/test-env.js";

describe("WhatsApp template send guardrails", () => {
  const clients: Client[] = [];
  let server: MockWhatsAppHttpServer | undefined;

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

  async function createMcp(
    configOverrides?: Parameters<typeof createTestWhatsAppConfig>[0],
  ) {
    server = await startMockWhatsAppHttpServer();
    const client = createTestWhatsAppClient(server);
    const connector = createWhatsAppConnector({
      client,
      config: createTestWhatsAppConfig(configOverrides),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "send-test", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("blocks send when disabled by default", async () => {
    const { mcpClient } = await createMcp({ sendEnabled: false });
    const result = await mcpClient.callTool({
      name: WHATSAPP_TEMPLATE_SEND_TOOL,
      arguments: {
        recipient: MOCK_RECIPIENT,
        templateName: "order_update",
        languageCode: "en_US",
        bodyParameters: ["Ada", "42"],
      },
    });
    expect(result.isError).toBe(true);
  });

  it("blocks recipient not on host allowlist", async () => {
    const { mcpClient } = await createMcp({
      sendEnabled: true,
      allowedRecipients: ["15559876543"],
    });
    const result = await mcpClient.callTool({
      name: WHATSAPP_TEMPLATE_SEND_TOOL,
      arguments: {
        recipient: MOCK_RECIPIENT,
        templateName: "order_update",
        languageCode: "en_US",
        bodyParameters: ["Ada", "42"],
      },
    });
    expect(result.isError).toBe(true);
  });

  it("blocks send without any configured opt-in allowlist", async () => {
    const { mcpClient } = await createMcp({
      sendEnabled: true,
      allowedRecipients: undefined,
    });
    const result = await mcpClient.callTool({
      name: WHATSAPP_TEMPLATE_SEND_TOOL,
      arguments: {
        recipient: MOCK_RECIPIENT,
        templateName: "order_update",
        languageCode: "en_US",
        bodyParameters: ["Ada", "42"],
      },
    });
    expect(result.isError).toBe(true);
  });

  it("sends once for an allowed approved template", async () => {
    const { mcpClient, server } = await createMcp({ sendEnabled: true });
    const result = await mcpClient.callTool({
      name: WHATSAPP_TEMPLATE_SEND_TOOL,
      arguments: {
        recipient: MOCK_RECIPIENT,
        templateName: "order_update",
        languageCode: "en_US",
        bodyParameters: ["Ada", "42"],
      },
    });
    expect(result.isError).not.toBe(true);
    expect(server!.getSendMessageCount()).toBe(1);
  });

  it("maps ambiguous send timeouts without retryable hints", async () => {
    const timeout = new Error("WhatsApp request timed out.");
    timeout.name = "TimeoutError";
    const mapped = mapWhatsAppError(timeout, { ambiguousSend: true });
    expect(mapped.retryable).not.toBe(true);
  });
});
