import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  STRIPE_ACCOUNT_GET_TOOL,
  STRIPE_BALANCE_GET_TOOL,
  STRIPE_BALANCE_TRANSACTION_LIST_TOOL,
  STRIPE_CHARGE_LIST_TOOL,
  STRIPE_CUSTOMER_GET_TOOL,
  STRIPE_INVOICE_LIST_TOOL,
  STRIPE_PAYMENT_INTENT_GET_TOOL,
  STRIPE_PAYMENT_INTENT_LIST_TOOL,
  STRIPE_REFUND_LIST_TOOL,
  STRIPE_SUBSCRIPTION_LIST_TOOL,
} from "../src/constants.js";
import { createStripeConnector } from "../src/connector.js";
import { mapStripeError } from "../src/map-stripe-error.js";
import {
  FAKE_STRIPE_API_KEY,
  MOCK_CUSTOMER_ID,
  MOCK_PAYMENT_INTENT_ID,
  startMockStripeHttpServer,
  type MockStripeHttpServer,
} from "./fixtures/mock-stripe-http-server.js";
import { createTestStripeClient } from "./helpers/test-env.js";

describe("Stripe connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockStripeHttpServer | undefined;

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
    mode?: import("./fixtures/mock-stripe-http-server.js").MockStripeMode,
    connectorOptions?: {
      allowedCustomerIds?: string[];
      allowLiveMode?: boolean;
    },
  ) {
    server = await startMockStripeHttpServer(mode ? { mode } : {});
    const client = createTestStripeClient(server);
    const connector = createStripeConnector({
      client,
      apiKeyForRedaction: FAKE_STRIPE_API_KEY,
      ...(connectorOptions?.allowedCustomerIds !== undefined
        ? { allowedCustomerIds: connectorOptions.allowedCustomerIds }
        : {}),
      ...(connectorOptions?.allowLiveMode !== undefined
        ? { allowLiveMode: connectorOptions.allowLiveMode }
        : {}),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({
      name: "fake-provider-test",
      version: "1.0",
    });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  async function callTool(
    mcpClient: Client,
    name: string,
    arguments_: Record<string, unknown>,
  ) {
    return mcpClient.callTool({ name, arguments: arguments_ });
  }

  it("exercises all ten tools against the fake provider", async () => {
    const { mcpClient } = await createLinkedClient();

    expect(
      (await callTool(mcpClient, STRIPE_ACCOUNT_GET_TOOL, {})).isError,
    ).not.toBe(true);
    expect(
      (await callTool(mcpClient, STRIPE_BALANCE_GET_TOOL, {})).isError,
    ).not.toBe(true);
    expect(
      (
        await callTool(mcpClient, STRIPE_BALANCE_TRANSACTION_LIST_TOOL, {
          limit: 10,
        })
      ).isError,
    ).not.toBe(true);
    expect(
      (
        await callTool(mcpClient, STRIPE_PAYMENT_INTENT_LIST_TOOL, {
          limit: 10,
        })
      ).isError,
    ).not.toBe(true);
    expect(
      (
        await callTool(mcpClient, STRIPE_PAYMENT_INTENT_GET_TOOL, {
          paymentIntentId: MOCK_PAYMENT_INTENT_ID,
        })
      ).isError,
    ).not.toBe(true);
    expect(
      (await callTool(mcpClient, STRIPE_CHARGE_LIST_TOOL, { limit: 10 }))
        .isError,
    ).not.toBe(true);
    expect(
      (await callTool(mcpClient, STRIPE_REFUND_LIST_TOOL, { limit: 10 }))
        .isError,
    ).not.toBe(true);
    expect(
      (
        await callTool(mcpClient, STRIPE_SUBSCRIPTION_LIST_TOOL, {
          limit: 10,
        })
      ).isError,
    ).not.toBe(true);
    expect(
      (await callTool(mcpClient, STRIPE_INVOICE_LIST_TOOL, { limit: 10 }))
        .isError,
    ).not.toBe(true);
    expect(
      (
        await callTool(mcpClient, STRIPE_CUSTOMER_GET_TOOL, {
          customerId: MOCK_CUSTOMER_ID,
        })
      ).isError,
    ).not.toBe(true);
  });

  it("maps forbidden provider errors", async () => {
    const mapped = mapStripeError(
      {
        kind: "http",
        status: 403,
        stripeCode: "permission_denied",
        stripeType: "permission_error",
      },
      { apiKey: FAKE_STRIPE_API_KEY },
    );
    expect(mapped.code).toBe("FORBIDDEN");
  });

  it("returns MCP errors for invalid input", async () => {
    const { mcpClient } = await createLinkedClient();
    const invalid = await callTool(mcpClient, STRIPE_PAYMENT_INTENT_GET_TOOL, {
      paymentIntentId: "not valid id!",
    });
    expect(invalid.isError).toBe(true);
  });

  it("rejects malicious pagination links from provider", async () => {
    const { mcpClient } = await createLinkedClient("malicious_paging");
    const result = await callTool(
      mcpClient,
      STRIPE_BALANCE_TRANSACTION_LIST_TOOL,
      { limit: 10 },
    );
    expect(result.isError).toBe(true);
  });

  it("does not expose customer PII from provider payloads", async () => {
    const { mcpClient } = await createLinkedClient("pii_customer");
    const result = await callTool(mcpClient, STRIPE_CUSTOMER_GET_TOOL, {
      customerId: MOCK_CUSTOMER_ID,
    });
    expect(result.isError).not.toBe(true);
    const text = JSON.stringify(result.content);
    expect(text).not.toContain("secret@example.com");
    expect(text).not.toContain("Secret Name");
  });

  it("enforces customer allowlist", async () => {
    const { mcpClient } = await createLinkedClient(undefined, {
      allowedCustomerIds: ["cus_other0001"],
    });
    const result = await callTool(mcpClient, STRIPE_CUSTOMER_GET_TOOL, {
      customerId: MOCK_CUSTOMER_ID,
    });
    expect(result.isError).toBe(true);
  });

  it("blocks live-mode resources when disabled", async () => {
    const { mcpClient } = await createLinkedClient("livemode", {
      allowLiveMode: false,
    });
    const result = await callTool(mcpClient, STRIPE_CUSTOMER_GET_TOOL, {
      customerId: MOCK_CUSTOMER_ID,
    });
    expect(result.isError).toBe(true);
  });
});
