import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SUPABASE_PROJECT_GET_TOOL,
  SUPABASE_SCHEMA_LIST_TOOL,
  SUPABASE_TABLE_COLUMNS_LIST_TOOL,
  SUPABASE_TABLE_GET_TOOL,
  SUPABASE_TABLE_LIST_TOOL,
  SUPABASE_TABLE_ROW_GET_TOOL,
  SUPABASE_TABLE_ROWS_COUNT_TOOL,
  SUPABASE_TABLE_ROWS_LIST_TOOL,
} from "../src/constants.js";
import { createSupabaseConnector } from "../src/connector.js";
import { FakeSupabaseProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestSupabaseConfig } from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  SUPABASE_PROJECT_GET_TOOL,
  SUPABASE_SCHEMA_LIST_TOOL,
  SUPABASE_TABLE_LIST_TOOL,
  SUPABASE_TABLE_GET_TOOL,
  SUPABASE_TABLE_COLUMNS_LIST_TOOL,
  SUPABASE_TABLE_ROWS_LIST_TOOL,
  SUPABASE_TABLE_ROW_GET_TOOL,
  SUPABASE_TABLE_ROWS_COUNT_TOOL,
];

describe("MCP compatibility (supabase)", () => {
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

  it("exposes exactly eight tools", async () => {
    const connector = createSupabaseConnector({
      client: new FakeSupabaseProviderClient(),
      config: defaultTestSupabaseConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "supabase-mcp", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const listed = await mcpClient.listTools({});
    const names = listed.tools.map((tool) => tool.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
