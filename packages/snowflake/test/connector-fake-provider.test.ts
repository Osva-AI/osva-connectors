import { describe, expect, it } from "vitest";

import { createSnowflakeConnector } from "../src/connector.js";
import { FakeSnowflakeProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestSnowflakeConfig } from "./helpers/test-env.js";

describe("connector with fake Snowflake provider", () => {
  it("database.get returns configured context", async () => {
    const client = new FakeSnowflakeProviderClient();
    const connector = createSnowflakeConnector({
      client,
      config: defaultTestSnowflakeConfig(),
    });
    const tool = connector.tools.find(
      (t) => t.name === "snowflake.database.get",
    )!;
    const result = (await tool.handler(
      {},
      {
        signal: new AbortController().signal,
      },
    )) as { database: string };
    expect(result.database).toBe("FIXTURE_DB");
    expect(client.executed).toHaveLength(0);
  });

  it("rows.sample uses server-built SELECT", async () => {
    const client = new FakeSnowflakeProviderClient();
    const connector = createSnowflakeConnector({
      client,
      config: defaultTestSnowflakeConfig(),
    });
    const tool = connector.tools.find(
      (t) => t.name === "snowflake.table.rows.sample",
    )!;
    const result = (await tool.handler(
      {
        schema: "APP",
        table: "USERS",
        columns: ["ID", "EMAIL"],
        limit: 2,
      },
      { signal: new AbortController().signal },
    )) as { rows: unknown[] };
    expect(result.rows.length).toBeGreaterThan(0);
    expect(client.executed[0]?.sql.toUpperCase()).toContain("SELECT");
    expect(client.executed[0]?.sql).toContain("?");
  });

  it("aggregate limits GROUP BY to two columns", async () => {
    const connector = createSnowflakeConnector({
      client: new FakeSnowflakeProviderClient(),
      config: defaultTestSnowflakeConfig(),
    });
    const tool = connector.tools.find(
      (t) => t.name === "snowflake.table.aggregate",
    )!;
    await expect(
      tool.handler(
        {
          schema: "APP",
          table: "USERS",
          metrics: [{ fn: "count" }],
          groupBy: ["ID", "EMAIL", "CREATED_AT"],
        },
        { signal: new AbortController().signal },
      ),
    ).rejects.toThrow(/Invalid tool input/i);
  });
});
