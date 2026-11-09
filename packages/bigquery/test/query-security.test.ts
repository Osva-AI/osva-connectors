import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { buildSampleQuery } from "../src/query-builder.js";
import { QueryConcurrencyGate, QueryExecutor } from "../src/query-executor.js";
import { validateFilterForTable } from "../src/structured-filters.js";
import { FakeBigQueryProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestBigqueryConfig } from "./helpers/test-env.js";

describe("query security", () => {
  it("builds parameterized SELECT without raw SQL input surface", () => {
    const built = buildSampleQuery({
      projectId: "fixture-project",
      datasetId: "analytics",
      tableId: "events",
      columns: ["event_name", "user_id"],
      limit: 5,
      filter: { op: "eq", column: "event_name", value: "signup" },
    });
    expect(built.sql).toMatch(/^SELECT /);
    expect(built.sql).not.toContain("signup");
    expect(Object.keys(built.params).length).toBeGreaterThan(0);
  });

  it("does not execute when dry-run exceeds max bytes billed", async () => {
    const client = new FakeBigQueryProviderClient();
    client.dryRunQuery = async function (this: FakeBigQueryProviderClient) {
      this.dryRunCallCount += 1;
      return { bytesProcessed: 9_999_999_999 };
    };
    const executor = new QueryExecutor(
      client,
      defaultTestBigqueryConfig({ maxBytesBilled: 1_000 }),
    );
    const built = buildSampleQuery({
      projectId: "fixture-project",
      datasetId: "analytics",
      tableId: "events",
      columns: ["event_name"],
      limit: 1,
    });
    await expect(
      executor.executeQuery({ sql: built.sql, params: built.params }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(client.dryRunCallCount).toBe(1);
    expect(client.runQueryCallCount).toBe(0);
  });

  it("dry-runs before executing queries", async () => {
    const client = new FakeBigQueryProviderClient();
    const executor = new QueryExecutor(client, defaultTestBigqueryConfig());
    const built = buildSampleQuery({
      projectId: "fixture-project",
      datasetId: "analytics",
      tableId: "events",
      columns: ["event_name"],
      limit: 2,
    });
    await executor.executeQuery({ sql: built.sql, params: built.params });
    expect(client.dryRunCallCount).toBe(1);
    expect(client.runQueryCallCount).toBe(1);
  });

  it("limits concurrent queries to two", async () => {
    const gate = new QueryConcurrencyGate(2);
    await gate.acquire();
    await gate.acquire();
    expect(gate.activeCount).toBe(2);
    gate.release();
    gate.release();
    expect(gate.activeCount).toBe(0);
  });

  it("rejects disallowed filter columns via allowlist", () => {
    expect(() =>
      validateFilterForTable(
        { op: "eq", column: "password", value: "x" },
        defaultTestBigqueryConfig().allowedTables,
        "analytics",
        "events",
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("connector aggregate rejects extra group-by", async () => {
    const built = buildSampleQuery({
      projectId: "fixture-project",
      datasetId: "analytics",
      tableId: "events",
      columns: ["event_name"],
      limit: 1,
    });
    const client = new FakeBigQueryProviderClient();
    client.dryRunQuery = async () => {
      throw new ConnectorSdkError("PROVIDER_ERROR", "dry-run failed");
    };
    const executor = new QueryExecutor(client, defaultTestBigqueryConfig());
    await expect(
      executor.executeQuery({ sql: built.sql, params: built.params }),
    ).rejects.toThrow(ConnectorSdkError);
  });
});
