import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { createBigqueryConnector } from "../src/connector.js";
import {
  BIGQUERY_TABLE_AGGREGATE_TOOL,
  BIGQUERY_TABLE_GET_TOOL,
  BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
} from "../src/constants.js";
import {
  assertColumnsPermitted,
  assertDataQueryAuthorized,
  assertDatasetAllowed,
  assertTableAllowed,
} from "../src/resource-scope.js";
import { FakeBigQueryProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestBigqueryConfig } from "./helpers/test-env.js";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";

async function linked(options?: {
  client?: FakeBigQueryProviderClient;
  config?: ReturnType<typeof defaultTestBigqueryConfig>;
}) {
  const provider = options?.client ?? new FakeBigQueryProviderClient();
  const connector = createBigqueryConnector({
    client: provider,
    config: options?.config ?? defaultTestBigqueryConfig(),
  });
  const mcpServer = createMcpServerFromConnector(connector);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "bq-auth", version: "1.0.0" });
  await mcpServer.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return { mcpClient, provider };
}

describe("authorization", () => {
  it("denies empty dataset allowlist", () => {
    expect(() => assertDatasetAllowed([], "analytics")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies tables outside allowlist", () => {
    expect(() =>
      assertTableAllowed({ analytics: { events: [] } }, "analytics", "secrets"),
    ).toThrow(ConnectorSdkError);
  });

  it("denies data queries when dataset allowlist is missing", () => {
    expect(() =>
      assertDataQueryAuthorized(
        undefined,
        { analytics: { events: ["id"] } },
        "analytics",
        "events",
      ),
    ).toThrow(/ALLOWED_DATASETS/);
  });

  it("denies data queries when table allowlist is missing", () => {
    expect(() =>
      assertDataQueryAuthorized(
        ["analytics"],
        undefined,
        "analytics",
        "events",
      ),
    ).toThrow(/ALLOWED_TABLES/);
  });

  it("denies missing and empty column allowlists", () => {
    expect(() =>
      assertColumnsPermitted(undefined, "analytics", "events", ["event_name"]),
    ).toThrow(ConnectorSdkError);
    expect(() =>
      assertColumnsPermitted(
        { analytics: { events: [] } },
        "analytics",
        "events",
        ["event_name"],
      ),
    ).toThrow(/No columns are permitted/);
  });

  it("connector rejects disallowed table access", async () => {
    const { mcpClient } = await linked();
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_GET_TOOL,
        arguments: { datasetId: "analytics", tableId: "secrets" },
      });
      expect(result.isError).toBe(true);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects unauthorized metric columns before provider calls", async () => {
    const { mcpClient, provider } = await linked();
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_AGGREGATE_TOOL,
        arguments: {
          datasetId: "analytics",
          tableId: "events",
          metrics: [{ fn: "sum", column: "password" }],
        },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/FORBIDDEN/);
      expect(provider.dryRunCallCount).toBe(0);
      expect(provider.runQueryCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects unauthorized group-by columns before provider calls", async () => {
    const { mcpClient, provider } = await linked();
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_AGGREGATE_TOOL,
        arguments: {
          datasetId: "analytics",
          tableId: "events",
          metrics: [{ fn: "count" }],
          groupBy: ["secret_col"],
        },
      });
      expect(result.isError).toBe(true);
      expect(provider.dryRunCallCount).toBe(0);
      expect(provider.runQueryCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects unauthorized filter columns before provider calls", async () => {
    const { mcpClient, provider } = await linked();
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
        arguments: {
          datasetId: "analytics",
          tableId: "events",
          filter: { op: "eq", column: "password", value: "x" },
        },
      });
      expect(result.isError).toBe(true);
      expect(provider.dryRunCallCount).toBe(0);
      expect(provider.runQueryCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects data queries when dataset allowlist is missing", async () => {
    const { mcpClient, provider } = await linked({
      config: defaultTestBigqueryConfig({ allowedDatasets: undefined }),
    });
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_AGGREGATE_TOOL,
        arguments: {
          datasetId: "analytics",
          tableId: "events",
          metrics: [{ fn: "count" }],
        },
      });
      expect(result.isError).toBe(true);
      expect(provider.dryRunCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects data queries when table allowlist is missing", async () => {
    const { mcpClient, provider } = await linked({
      config: defaultTestBigqueryConfig({ allowedTables: undefined }),
    });
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_ROWS_SAMPLE_TOOL,
        arguments: { datasetId: "analytics", tableId: "events" },
      });
      expect(result.isError).toBe(true);
      expect(provider.dryRunCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects COUNT injection payloads with zero provider calls", async () => {
    const { mcpClient, provider } = await linked();
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_AGGREGATE_TOOL,
        arguments: {
          datasetId: "analytics",
          tableId: "events",
          metrics: [{ fn: "count", column: "x`) FROM `p`.`d`.`secrets` --" }],
        },
      });
      expect(result.isError).toBe(true);
      expect(provider.dryRunCallCount).toBe(0);
      expect(provider.runQueryCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("allows valid COUNT(*) aggregation", async () => {
    const { mcpClient, provider } = await linked();
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_AGGREGATE_TOOL,
        arguments: {
          datasetId: "analytics",
          tableId: "events",
          metrics: [{ fn: "count" }],
        },
      });
      expect(result.isError).not.toBe(true);
      expect(provider.dryRunCallCount).toBe(1);
      expect(provider.runQueryCallCount).toBe(1);
    } finally {
      await mcpClient.close();
    }
  });
});
