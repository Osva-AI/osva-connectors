import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { buildAggregateQuery, buildSampleQuery } from "../src/query-builder.js";
import { QueryConcurrencyGate, QueryExecutor } from "../src/query-executor.js";
import { validateFilterForTable } from "../src/structured-filters.js";
import { FakeBigQueryProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestBigqueryConfig } from "./helpers/test-env.js";

const INJECTION_COLUMN = "x`) FROM `p`.`d`.`secrets` --";

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

  it("propagates dry-run provider failures without executing", async () => {
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
    expect(client.runQueryCallCount).toBe(0);
  });

  it("rejects invalid COUNT column on direct query-builder invocation", () => {
    expect(() =>
      buildAggregateQuery({
        projectId: "fixture-project",
        datasetId: "analytics",
        tableId: "events",
        metrics: [{ fn: "count", column: INJECTION_COLUMN }],
        limit: 10,
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects invalid SUM column", () => {
    expect(() =>
      buildAggregateQuery({
        projectId: "fixture-project",
        datasetId: "analytics",
        tableId: "events",
        metrics: [{ fn: "sum", column: INJECTION_COLUMN }],
        limit: 10,
      }),
    ).toThrow(/Invalid column identifier/);
  });

  it("rejects invalid AVG column", () => {
    expect(() =>
      buildAggregateQuery({
        projectId: "fixture-project",
        datasetId: "analytics",
        tableId: "events",
        metrics: [{ fn: "avg", column: "user-id" }],
        limit: 10,
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects invalid MIN and MAX columns", () => {
    expect(() =>
      buildAggregateQuery({
        projectId: "fixture-project",
        datasetId: "analytics",
        tableId: "events",
        metrics: [{ fn: "min", column: "1value" }],
        limit: 10,
      }),
    ).toThrow(ConnectorSdkError);
    expect(() =>
      buildAggregateQuery({
        projectId: "fixture-project",
        datasetId: "analytics",
        tableId: "events",
        metrics: [{ fn: "max", column: "value;" }],
        limit: 10,
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects invalid aggregate aliases", () => {
    expect(() =>
      buildAggregateQuery({
        projectId: "fixture-project",
        datasetId: "analytics",
        tableId: "events",
        metrics: [{ fn: "count", alias: "x` AS leaked" }],
        limit: 10,
      }),
    ).toThrow(/Invalid aggregate alias/);
  });

  it("rejects unsafe generated aliases derived from invalid columns", () => {
    expect(() =>
      buildAggregateQuery({
        projectId: "fixture-project",
        datasetId: "analytics",
        tableId: "events",
        metrics: [{ fn: "count", column: INJECTION_COLUMN }],
        limit: 10,
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects invalid group-by identifiers", () => {
    expect(() =>
      buildAggregateQuery({
        projectId: "fixture-project",
        datasetId: "analytics",
        tableId: "events",
        metrics: [{ fn: "count" }],
        groupBy: ["event_name`; DROP TABLE t; --"],
        limit: 10,
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects SQL metacharacters and boundary characters in identifiers", () => {
    const unsafe = [
      "col`",
      "col;drop",
      "col space",
      ".col",
      "col.nested",
      "col-name",
      "1col",
      "",
    ];
    for (const column of unsafe) {
      expect(() =>
        buildAggregateQuery({
          projectId: "fixture-project",
          datasetId: "analytics",
          tableId: "events",
          metrics: [{ fn: "sum", column }],
          limit: 10,
        }),
      ).toThrow(ConnectorSdkError);
    }
  });

  it("builds valid COUNT(*) and COUNT(column) with parameters", () => {
    const star = buildAggregateQuery({
      projectId: "fixture-project",
      datasetId: "analytics",
      tableId: "events",
      metrics: [{ fn: "count" }],
      limit: 5,
    });
    expect(star.sql).toContain("COUNT(*)");
    expect(star.sql).not.toContain(INJECTION_COLUMN);
    expect(star.params.lim_0).toBe(5);

    const counted = buildAggregateQuery({
      projectId: "fixture-project",
      datasetId: "analytics",
      tableId: "events",
      metrics: [{ fn: "count", column: "user_id", alias: "users" }],
      groupBy: ["event_name"],
      filter: { op: "eq", column: "event_name", value: "signup" },
      limit: 8,
    });
    expect(counted.sql).toContain("COUNT(`user_id`)");
    expect(counted.sql).toContain("AS `users`");
    expect(counted.sql).toContain("GROUP BY `event_name`");
    expect(counted.sql).not.toContain("signup");
    expect(Object.values(counted.params)).toContain("signup");
  });
});
