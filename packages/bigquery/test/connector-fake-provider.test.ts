import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  BIGQUERY_TABLE_COLUMNS_LIST_TOOL,
  BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
} from "../src/constants.js";
import { createBigqueryConnector } from "../src/connector.js";
import { FakeBigQueryProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestBigqueryConfig } from "./helpers/test-env.js";

describe("BigQuery connector fake provider", () => {
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

  async function linkedClient(client = new FakeBigQueryProviderClient()) {
    const connector = createBigqueryConnector({
      client,
      config: defaultTestBigqueryConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "bigquery-fake", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, provider: client };
  }

  it("lists columns and samples rows with dry-run", async () => {
    const { mcpClient, provider } = await linkedClient();
    const columns = await mcpClient.callTool({
      name: BIGQUERY_TABLE_COLUMNS_LIST_TOOL,
      arguments: { datasetId: "analytics", tableId: "events" },
    });
    expect(columns.isError).not.toBe(true);
    expect(JSON.stringify(columns.content)).toContain("event_name");

    const sample = await mcpClient.callTool({
      name: BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
      arguments: {
        datasetId: "analytics",
        tableId: "events",
        limit: 2,
      },
    });
    expect(sample.isError).not.toBe(true);
    expect(provider.dryRunCallCount).toBeGreaterThan(0);
    expect(JSON.stringify(sample.content)).toContain("signup");
  });
});
