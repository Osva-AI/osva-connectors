/**
 * Reliability integration: deadlines, cancellation, pool behavior.
 */
import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterAll, describe, expect, it } from "vitest";

import { loadPostgresConfig } from "../src/config.js";
import {
  POSTGRES_CONNECTION_TEST_TOOL,
  POSTGRES_QUERY_READ_TOOL,
} from "../src/constants.js";
import { createPostgresConnector } from "../src/connector.js";
import type { QueryReadOutput } from "../src/query-read-schemas.js";
import {
  createPgDatabase,
  createPostgresPool,
} from "../src/postgres-client.js";

const INTEGRATION_URL = process.env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL;

function buildReliabilityConnector(env: Record<string, string>) {
  const config = loadPostgresConfig({
    OSVA_CONNECTOR_POSTGRES_URL: INTEGRATION_URL!,
    OSVA_CONNECTOR_POSTGRES_SSL_MODE: "disable",
    ...env,
  });
  const pool = createPostgresPool(config);
  return {
    pool,
    config,
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

async function runQuery(
  connector: ReturnType<typeof createPostgresConnector>,
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<QueryReadOutput> {
  const tool = connector.tools.find(
    (t) => t.name === POSTGRES_QUERY_READ_TOOL,
  )!;
  return (await tool.handler(input, {
    signal: signal ?? new AbortController().signal,
  })) as QueryReadOutput;
}

const describeIntegration = INTEGRATION_URL ? describe : describe.skip;

describeIntegration("postgres reliability integration", () => {
  let close: (() => Promise<void>) | undefined;

  afterAll(async () => {
    await close?.();
  });

  it("completes within the total operation deadline", async () => {
    const built = buildReliabilityConnector({
      OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "10000",
    });
    close = built.close;
    const result = await runQuery(built.connector, {
      sql: "SELECT id FROM app.users WHERE id = 1",
    });
    expect(result.rowCount).toBe(1);
  });

  it("fails when pg_sleep exceeds the total deadline", async () => {
    const built = buildReliabilityConnector({
      OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "5000",
      OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS: "120000",
    });
    close = built.close;
    await expect(
      runQuery(built.connector, { sql: "SELECT app.sleep_seconds(8)" }),
    ).rejects.toMatchObject({
      code: "TIMEOUT",
      message: "PostgreSQL request exceeded the total operation deadline.",
    });
  }, 15_000);

  it("cancels a long-running query via AbortSignal", async () => {
    const built = buildReliabilityConnector({
      OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "60000",
      OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS: "120000",
    });
    close = built.close;
    const controller = new AbortController();
    const pending = runQuery(
      built.connector,
      { sql: "SELECT app.sleep_seconds(8)" },
      controller.signal,
    );
    setTimeout(() => controller.abort(), 400);
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
  }, 20_000);

  it("cancels while waiting for a pool connection and recovers", async () => {
    const built = buildReliabilityConnector({
      OSVA_CONNECTOR_POSTGRES_POOL_MAX: "1",
      OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "60000",
      OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS: "120000",
    });
    close = built.close;

    const hold = runQuery(built.connector, {
      sql: "SELECT app.sleep_seconds(6)",
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const controller = new AbortController();
    const queued = runQuery(
      built.connector,
      { sql: "SELECT 1 AS ok" },
      controller.signal,
    );
    setTimeout(() => controller.abort(), 400);
    await expect(queued).rejects.toMatchObject({ code: "CANCELLED" });

    await hold;

    const health = built.connector.tools.find(
      (t) => t.name === POSTGRES_CONNECTION_TEST_TOOL,
    )!;
    await expect(
      health.handler({}, { signal: new AbortController().signal }),
    ).resolves.toMatchObject({ ok: true });
  }, 20_000);

  it("supports concurrent queries when pool max is greater than 1", async () => {
    const built = buildReliabilityConnector({
      OSVA_CONNECTOR_POSTGRES_POOL_MAX: "2",
      OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "30000",
    });
    close = built.close;
    const [a, b] = await Promise.all([
      runQuery(built.connector, {
        sql: "SELECT id FROM app.users WHERE id = 1",
      }),
      runQuery(built.connector, {
        sql: "SELECT label FROM app.rls_items ORDER BY label",
      }),
    ]);
    expect(a.rowCount).toBe(1);
    expect(b.rowCount).toBe(1);
  });

  it("recovers after statement timeout", async () => {
    const built = buildReliabilityConnector({
      OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS: "1000",
      OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "30000",
    });
    close = built.close;
    await expect(
      runQuery(built.connector, { sql: "SELECT app.sleep_seconds(2)" }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });

    const ping = built.connector.tools.find(
      (t) => t.name === POSTGRES_CONNECTION_TEST_TOOL,
    )!;
    await expect(
      ping.handler({}, { signal: new AbortController().signal }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("does not leak pool capacity after repeated failures", async () => {
    const built = buildReliabilityConnector({
      OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "5000",
      OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS: "120000",
    });
    close = built.close;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        runQuery(built.connector, { sql: "SELECT app.sleep_seconds(8)" }),
      ).rejects.toBeInstanceOf(ConnectorSdkError);
    }
    expect(built.pool.waitingCount).toBe(0);
    expect(built.pool.totalCount).toBeLessThanOrEqual(built.config.poolMax);
  }, 60_000);
});
