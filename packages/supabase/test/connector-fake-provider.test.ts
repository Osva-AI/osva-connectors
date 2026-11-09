import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SUPABASE_TABLE_ROW_GET_TOOL,
  SUPABASE_TABLE_ROWS_COUNT_TOOL,
  SUPABASE_TABLE_ROWS_LIST_TOOL,
} from "../src/constants.js";
import { createSupabaseConnector } from "../src/connector.js";
import { FakeSupabaseProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestSupabaseConfig } from "./helpers/test-env.js";

describe("Supabase connector (fake provider)", () => {
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

  async function createLinkedClient(config = defaultTestSupabaseConfig()) {
    const provider = new FakeSupabaseProviderClient();
    const connector = createSupabaseConnector({ client: provider, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "supabase-fake", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, provider };
  }

  it("lists rows with allowlisted columns", async () => {
    const { mcpClient, provider } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: SUPABASE_TABLE_ROWS_LIST_TOOL,
      arguments: { schema: "public", table: "users", limit: 1 },
    });
    expect(result.isError).not.toBe(true);
    expect(provider.selectCalls[0]?.columns).toEqual(["id", "email", "name"]);
    const text = JSON.stringify(result.structuredContent ?? result.content);
    expect(text).not.toContain('"*"');
  });

  it("blocks exact count when host gate disabled", async () => {
    const { mcpClient } = await createLinkedClient(
      defaultTestSupabaseConfig({ countExactEnabled: false }),
    );
    const result = await mcpClient.callTool({
      name: SUPABASE_TABLE_ROWS_COUNT_TOOL,
      arguments: { schema: "public", table: "users", exact: true },
    });
    expect(result.isError).toBe(true);
  });

  it("fetches a single row using lookupColumn", async () => {
    const { mcpClient, provider } = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: SUPABASE_TABLE_ROW_GET_TOOL,
      arguments: {
        schema: "public",
        table: "users",
        lookupValue: "1",
      },
    });
    expect(result.isError).not.toBe(true);
    expect(provider.selectCalls.at(-1)?.filters?.[0]).toMatchObject({
      column: "id",
      operator: "eq",
    });
  });
});
