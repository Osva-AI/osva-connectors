import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  WHATSAPP_ANALYTICS_GET_TOOL,
  WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL,
  WHATSAPP_BUSINESS_PROFILE_GET_TOOL,
  WHATSAPP_PHONE_NUMBER_GET_TOOL,
  WHATSAPP_PHONE_NUMBER_LIST_TOOL,
  WHATSAPP_TEMPLATE_GET_TOOL,
  WHATSAPP_TEMPLATE_LIST_TOOL,
} from "../src/constants.js";
import { createWhatsAppConnector } from "../src/connector.js";
import { mapWhatsAppError } from "../src/map-whatsapp-error.js";
import {
  FAKE_WHATSAPP_ACCESS_TOKEN,
  MOCK_PHONE_NUMBER_ID,
  MOCK_TEMPLATE_ID,
  MOCK_WABA_ID,
  startMockWhatsAppHttpServer,
  type MockWhatsAppHttpServer,
  type MockWhatsAppMode,
} from "./fixtures/mock-whatsapp-http-server.js";
import {
  createTestWhatsAppClient,
  createTestWhatsAppConfig,
} from "./helpers/test-env.js";

describe("WhatsApp connector (fake provider)", () => {
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

  async function callTool(
    tool: string,
    args: Record<string, unknown>,
    mode?: MockWhatsAppMode,
    configOverrides?: Parameters<typeof createTestWhatsAppConfig>[0],
  ) {
    server = await startMockWhatsAppHttpServer(
      mode !== undefined ? { mode } : {},
    );
    const client = createTestWhatsAppClient(server);
    const connector = createWhatsAppConnector({
      client,
      config: createTestWhatsAppConfig(configOverrides),
      accessTokenForRedaction: FAKE_WHATSAPP_ACCESS_TOKEN,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient.callTool({ name: tool, arguments: args });
  }

  it("covers all eight read tools", async () => {
    const calls: Array<[string, Record<string, unknown>]> = [
      [WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL, {}],
      [WHATSAPP_PHONE_NUMBER_LIST_TOOL, { limit: 5 }],
      [WHATSAPP_PHONE_NUMBER_GET_TOOL, {}],
      [WHATSAPP_BUSINESS_PROFILE_GET_TOOL, {}],
      [WHATSAPP_TEMPLATE_LIST_TOOL, { limit: 5 }],
      [WHATSAPP_TEMPLATE_GET_TOOL, { templateId: MOCK_TEMPLATE_ID }],
      [
        WHATSAPP_ANALYTICS_GET_TOOL,
        {
          startDate: "2025-01-01",
          endDate: "2025-01-07",
          templateIds: [MOCK_TEMPLATE_ID],
          metricTypes: ["SENT", "DELIVERED"],
        },
      ],
    ];

    for (const [tool, args] of calls) {
      const result = await callTool(tool, args);
      expect(result.isError).not.toBe(true);
    }
  });

  it("rejects WABA mismatch", async () => {
    const result = await callTool(WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL, {
      wabaId: "9999999999999",
    });
    expect(result.isError).toBe(true);
  });

  it("filters phone numbers using allowlist", async () => {
    const result = await callTool(
      WHATSAPP_PHONE_NUMBER_LIST_TOOL,
      { limit: 10 },
      undefined,
      { allowedPhoneNumberIds: ["0000000000000"] },
    );
    expect(result.isError).not.toBe(true);
    const text = JSON.stringify(result);
    expect(text).not.toContain(MOCK_PHONE_NUMBER_ID);
  });

  it("rejects malicious pagination links", async () => {
    const result = await callTool(
      WHATSAPP_PHONE_NUMBER_LIST_TOOL,
      { limit: 10 },
      "malicious_paging",
    );
    expect(result.isError).toBe(true);
  });

  it("maps unauthorized responses without leaking token", async () => {
    const result = await callTool(
      WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL,
      {},
      "unauthorized",
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(FAKE_WHATSAPP_ACCESS_TOKEN);
  });

  it("maps rate limits from provider", async () => {
    server = await startMockWhatsAppHttpServer({ mode: "rate_limit" });
    const client = createTestWhatsAppClient(server);
    await expect(
      client.getNode({ path: MOCK_WABA_ID, fields: ["id"] }),
    ).rejects.toBeTruthy();
    try {
      await client.getNode({ path: MOCK_WABA_ID, fields: ["id"] });
    } catch (error) {
      const mapped = mapWhatsAppError(error, {
        accessToken: FAKE_WHATSAPP_ACCESS_TOKEN,
      });
      expect(mapped.code).toBe("RATE_LIMITED");
    }
  });

  it("rejects oversized provider payloads", async () => {
    server = await startMockWhatsAppHttpServer({ mode: "oversized" });
    const client = createTestWhatsAppClient(server);
    await expect(
      client.getNode({ path: MOCK_WABA_ID, fields: ["id"] }),
    ).rejects.toBeTruthy();
  });
});
