import { describe, expect, it } from "vitest";

import { ContinuationStore } from "../src/continuation-store.js";
import { CONNECTOR_KEY } from "../src/constants.js";
import { createSnowflakeConnector } from "../src/connector.js";
import { FakeSnowflakeProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestSnowflakeConfig } from "./helpers/test-env.js";

describe("pagination (snowflake)", () => {
  it("issues and resolves row sample continuation", async () => {
    const store = new ContinuationStore();
    const client = new FakeSnowflakeProviderClient();
    const connector = createSnowflakeConnector({
      client,
      config: defaultTestSnowflakeConfig(),
      continuationStore: store,
    });
    const tool = connector.tools.find(
      (t) => t.name === "snowflake.table.rows.sample",
    )!;
    const first = (await tool.handler(
      { schema: "APP", table: "USERS", limit: 1 },
      { signal: new AbortController().signal },
    )) as { continuationToken?: string; rows: unknown[] };
    expect(first.rows).toHaveLength(1);
    expect(first.continuationToken).toBeDefined();
    const token = first.continuationToken!;
    const scope = {
      connectorKey: CONNECTOR_KEY,
      family: "table.rows.sample" as const,
      schema: "APP",
      table: "USERS",
      pageSize: 1,
    };
    expect(store.resolve(token, scope)).toBe("1");
  });
});
