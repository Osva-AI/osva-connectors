import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  CONNECTION_TEST_SQL,
  POSTGRES_CONNECTION_TEST_TOOL,
} from "../src/constants.js";
import { createPostgresConnector } from "../src/connector.js";
import { createMockPostgresDatabase } from "./helpers/mock-postgres-database.js";

describe("postgres.connection.test", () => {
  it("executes only the fixed health query", async () => {
    const queries: string[] = [];
    const database = createMockPostgresDatabase({
      onQuery: (sql) => queries.push(sql),
    });
    const connector = createPostgresConnector({ database });
    const tool = connector.tools.find(
      (t) => t.name === POSTGRES_CONNECTION_TEST_TOOL,
    );
    expect(tool).toBeDefined();

    const output = await tool!.handler(
      {},
      { signal: new AbortController().signal },
    );
    expect(queries).toEqual([CONNECTION_TEST_SQL]);
    expect(output).toMatchObject({
      ok: true,
      serverVersion: expect.any(String),
    });
  });

  it("rejects unexpected input properties", async () => {
    const connector = createPostgresConnector({
      database: createMockPostgresDatabase(),
    });
    const tool = connector.tools.find(
      (t) => t.name === POSTGRES_CONNECTION_TEST_TOOL,
    )!;
    await expect(
      tool.handler(
        { sql: "SELECT 1" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("maps connection failures to sanitized connector errors", async () => {
    const connector = createPostgresConnector({
      database: createMockPostgresDatabase({
        queryError: Object.assign(new Error("boom"), { code: "ECONNREFUSED" }),
      }),
    });
    const tool = connector.tools.find(
      (t) => t.name === POSTGRES_CONNECTION_TEST_TOOL,
    )!;
    await expect(
      tool.handler({}, { signal: new AbortController().signal }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });
});
