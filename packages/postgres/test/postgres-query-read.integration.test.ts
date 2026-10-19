/**
 * Real PostgreSQL integration for postgres.query.read.
 */
import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterAll, describe, expect, it } from "vitest";

import { createPostgresConnector } from "../src/connector.js";
import { loadPostgresConfig } from "../src/config.js";
import {
  POSTGRES_CONNECTION_TEST_TOOL,
  POSTGRES_QUERY_READ_TOOL,
} from "../src/constants.js";
import type { QueryReadOutput } from "../src/query-read-schemas.js";
import {
  createPgDatabase,
  createPostgresPool,
} from "../src/postgres-client.js";

const INTEGRATION_URL = process.env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL;

function buildQueryConnector(
  options: {
    queryTimeoutMs?: number;
    totalTimeoutMs?: number;
    poolMax?: number;
  } = {},
) {
  const config = loadPostgresConfig({
    OSVA_CONNECTOR_POSTGRES_URL: INTEGRATION_URL!,
    OSVA_CONNECTOR_POSTGRES_SSL_MODE: "disable",
    ...(options.queryTimeoutMs !== undefined
      ? {
          OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS: String(
            options.queryTimeoutMs,
          ),
        }
      : {}),
    ...(options.totalTimeoutMs !== undefined
      ? {
          OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: String(
            options.totalTimeoutMs,
          ),
        }
      : {}),
    ...(options.poolMax !== undefined
      ? { OSVA_CONNECTOR_POSTGRES_POOL_MAX: String(options.poolMax) }
      : {}),
  });
  const pool = createPostgresPool(config);
  return {
    connector: createPostgresConnector({
      database: createPgDatabase(pool, config),
      pool,
      queryTimeoutMs: config.queryTimeoutMs,
      totalTimeoutMs: config.totalTimeoutMs,
    }),
    close: async () => {
      await pool.end();
    },
  };
}

function queryTool(connector: ReturnType<typeof createPostgresConnector>) {
  const found = connector.tools.find(
    (t) => t.name === POSTGRES_QUERY_READ_TOOL,
  );
  if (found === undefined) {
    throw new Error(`Missing tool ${POSTGRES_QUERY_READ_TOOL}`);
  }
  return found;
}

async function runQuery(
  connector: ReturnType<typeof createPostgresConnector>,
  input: Parameters<ReturnType<typeof queryTool>["handler"]>[0],
): Promise<QueryReadOutput> {
  const tool = queryTool(connector);
  return (await tool.handler(input, {
    signal: new AbortController().signal,
  })) as QueryReadOutput;
}

const describeIntegration = INTEGRATION_URL ? describe : describe.skip;

describeIntegration("postgres.query.read integration", () => {
  let close: (() => Promise<void>) | undefined;

  afterAll(async () => {
    await close?.();
  });

  it("runs a parameterized SELECT with correct binding", async () => {
    const built = buildQueryConnector();
    close = built.close;
    const result = await runQuery(built.connector, {
      sql: "SELECT id, email FROM app.users WHERE id = $1",
      params: [1],
      maxRows: 10,
    });
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
    expect(result.columns.map((c) => c.name)).toEqual(["id", "email"]);
    expect(result.rows[0]?.[0]).toBe(1);
  });

  it("rejects multiple statements and write attempts at admission", async () => {
    const built = buildQueryConnector();
    close = built.close;
    const tool = queryTool(built.connector);
    await expect(
      tool.handler(
        { sql: "SELECT 1; SELECT 2" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler(
        { sql: "INSERT INTO app.users VALUES (99, 'x')" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler(
        {
          sql: "WITH d AS (DELETE FROM app.users RETURNING *) SELECT * FROM d",
        },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler(
        { sql: "SELECT * FROM app.users FOR UPDATE" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("denies hidden schemas and unauthorized columns", async () => {
    const built = buildQueryConnector();
    close = built.close;
    await expect(
      runQuery(built.connector, {
        sql: "SELECT token FROM secret.credentials",
      }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
    await expect(
      runQuery(built.connector, { sql: "SELECT col_b FROM app.partial_cols" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const allowed = await runQuery(built.connector, {
      sql: "SELECT col_a FROM app.partial_cols LIMIT 1",
    });
    expect(allowed.rowCount).toBe(1);
    expect(allowed.rows[0]?.[0]).toBe("visible");
  });

  it("enforces RLS for the reader role", async () => {
    const built = buildQueryConnector();
    close = built.close;
    const result = await runQuery(built.connector, {
      sql: "SELECT label FROM app.rls_items ORDER BY label",
    });
    expect(result.rows.map((row) => row[0])).toEqual(["visible-a"]);
  });

  it("times out slow queries and leaves the pool usable", async () => {
    const built = buildQueryConnector({ queryTimeoutMs: 1_000 });
    close = built.close;
    await expect(
      runQuery(built.connector, { sql: "SELECT app.sleep_seconds(2)" }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });

    const health = built.connector.tools.find(
      (t) => t.name === POSTGRES_CONNECTION_TEST_TOOL,
    )!;
    const ping = await health.handler(
      {},
      { signal: new AbortController().signal },
    );
    expect(ping).toMatchObject({ ok: true });
  });

  it("truncates row count and omits credentials from errors", async () => {
    const built = buildQueryConnector();
    close = built.close;
    const tool = queryTool(built.connector);
    const limited = await runQuery(built.connector, {
      sql: "SELECT id FROM generate_series(1, 20) AS id",
      maxRows: 5,
    });
    expect(limited.rowCount).toBe(5);
    expect(limited.truncated).toBe(true);
    expect(limited.maxRows).toBe(5);

    try {
      await tool.handler(
        { sql: "SELECT no_such_column FROM app.users" },
        { signal: new AbortController().signal },
      );
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorSdkError);
      const serialized = JSON.stringify(error);
      expect(serialized).not.toContain("reader_pass");
    }
  });
});
