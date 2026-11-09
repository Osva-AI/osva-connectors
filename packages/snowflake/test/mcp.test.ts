import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  SNOWFLAKE_DATABASE_GET_TOOL,
  SNOWFLAKE_SCHEMA_GET_TOOL,
  SNOWFLAKE_SCHEMA_LIST_TOOL,
  SNOWFLAKE_TABLE_AGGREGATE_TOOL,
  SNOWFLAKE_TABLE_COLUMNS_LIST_TOOL,
  SNOWFLAKE_TABLE_GET_TOOL,
  SNOWFLAKE_TABLE_LIST_TOOL,
  SNOWFLAKE_TABLE_ROWS_SAMPLE_TOOL,
} from "../src/constants.js";
import { createSnowflakeConnector } from "../src/connector.js";
import { FakeSnowflakeProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestSnowflakeConfig } from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  SNOWFLAKE_DATABASE_GET_TOOL,
  SNOWFLAKE_SCHEMA_LIST_TOOL,
  SNOWFLAKE_SCHEMA_GET_TOOL,
  SNOWFLAKE_TABLE_LIST_TOOL,
  SNOWFLAKE_TABLE_GET_TOOL,
  SNOWFLAKE_TABLE_COLUMNS_LIST_TOOL,
  SNOWFLAKE_TABLE_ROWS_SAMPLE_TOOL,
  SNOWFLAKE_TABLE_AGGREGATE_TOOL,
];

describe("MCP compatibility (snowflake)", () => {
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

  it("exposes exactly eight read-only tools", async () => {
    const connector = createSnowflakeConnector({
      client: new FakeSnowflakeProviderClient(),
      config: defaultTestSnowflakeConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "snowflake-mcp", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const listed = await mcpClient.listTools({});
    const names = listed.tools.map((tool) => tool.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
