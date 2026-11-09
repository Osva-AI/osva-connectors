import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  BIGQUERY_DATASET_GET_TOOL,
  BIGQUERY_DATASET_LIST_TOOL,
  BIGQUERY_PROJECT_GET_TOOL,
  BIGQUERY_TABLE_AGGREGATE_TOOL,
  BIGQUERY_TABLE_COLUMNS_LIST_TOOL,
  BIGQUERY_TABLE_GET_TOOL,
  BIGQUERY_TABLE_LIST_TOOL,
  BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
} from "../src/constants.js";
import { createBigqueryConnector } from "../src/connector.js";
import { FakeBigQueryProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestBigqueryConfig } from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  BIGQUERY_PROJECT_GET_TOOL,
  BIGQUERY_DATASET_LIST_TOOL,
  BIGQUERY_DATASET_GET_TOOL,
  BIGQUERY_TABLE_LIST_TOOL,
  BIGQUERY_TABLE_GET_TOOL,
  BIGQUERY_TABLE_COLUMNS_LIST_TOOL,
  BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
  BIGQUERY_TABLE_AGGREGATE_TOOL,
];

describe("MCP compatibility (bigquery)", () => {
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
    const connector = createBigqueryConnector({
      client: new FakeBigQueryProviderClient(),
      config: defaultTestBigqueryConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "bigquery-mcp", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const listed = await mcpClient.listTools({});
    const names = listed.tools.map((tool) => tool.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
