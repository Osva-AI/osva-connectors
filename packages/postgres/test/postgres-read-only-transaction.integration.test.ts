/**
 * READ ONLY enforcement at the database layer (bypasses SQL admission).
 */
import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterAll, describe, expect, it } from "vitest";

import { loadPostgresConfig } from "../src/config.js";
import { mapPostgresError } from "../src/map-postgres-error.js";
import { createPostgresPool } from "../src/postgres-client.js";
import { withReadOnlyTransaction } from "../src/query-read/read-only-transaction.js";

const WRITER_URL = process.env.OSVA_CONNECTOR_POSTGRES_WRITER_INTEGRATION_URL;
const INTEGRATION_URL = process.env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL;

const describeIntegration =
  WRITER_URL && INTEGRATION_URL ? describe : describe.skip;

describeIntegration("READ ONLY transaction enforcement", () => {
  let close: (() => Promise<void>) | undefined;

  afterAll(async () => {
    await close?.();
  });

  function buildWriterPool() {
    const config = loadPostgresConfig({
      OSVA_CONNECTOR_POSTGRES_URL: WRITER_URL!,
      OSVA_CONNECTOR_POSTGRES_SSL_MODE: "disable",
    });
    const pool = createPostgresPool(config);
    close = async () => {
      await pool.end();
    };
    return { pool, config };
  }

  async function probeNote(pool: ReturnType<typeof createPostgresPool>) {
    const result = await pool.query(
      "SELECT note FROM app.read_only_probe ORDER BY id LIMIT 1",
    );
    return result.rows[0]?.["note"];
  }

  it("blocks INSERT, UPDATE and DELETE while leaving data unchanged", async () => {
    const { pool, config } = buildWriterPool();
    const before = await probeNote(pool);

    for (const sql of [
      "INSERT INTO app.read_only_probe (note) VALUES ('blocked-insert')",
      "UPDATE app.read_only_probe SET note = 'blocked-update'",
      "DELETE FROM app.read_only_probe",
    ]) {
      try {
        await withReadOnlyTransaction(
          pool,
          {
            statementTimeoutMs: config.queryTimeoutMs,
            lockTimeoutMs: 5_000,
            totalTimeoutMs: config.totalTimeoutMs,
          },
          async (client) => {
            await client.query(sql);
          },
        );
        throw new Error("expected read-only failure");
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "expected read-only failure"
        ) {
          throw error;
        }
        expect(mapPostgresError(error).code).toBe("INVALID_INPUT");
      }
    }

    const after = await probeNote(pool);
    expect(after).toBe(before);
  });

  it("maps PostgreSQL read-only violations without leaking credentials", async () => {
    const { pool, config } = buildWriterPool();
    try {
      await withReadOnlyTransaction(
        pool,
        {
          statementTimeoutMs: config.queryTimeoutMs,
          lockTimeoutMs: 5_000,
          totalTimeoutMs: config.totalTimeoutMs,
        },
        async (client) => {
          await client.query(
            "INSERT INTO app.read_only_probe (note) VALUES ('x')",
          );
        },
      );
      throw new Error("expected failure");
    } catch (error) {
      const mapped = mapPostgresError(error);
      expect(mapped).toBeInstanceOf(ConnectorSdkError);
      expect(mapped.code).toBe("INVALID_INPUT");
      expect(JSON.stringify(mapped)).not.toContain("writer_pass");
    }

    const note = await probeNote(pool);
    expect(note).toBe("seed");
  });

  it("leaves the pool usable after a read-only write failure", async () => {
    const { pool, config } = buildWriterPool();
    await expect(
      withReadOnlyTransaction(
        pool,
        {
          statementTimeoutMs: config.queryTimeoutMs,
          lockTimeoutMs: 5_000,
          totalTimeoutMs: config.totalTimeoutMs,
        },
        async (client) => {
          await client.query("DELETE FROM app.read_only_probe");
        },
      ),
    ).rejects.toMatchObject({ code: "25006" });

    const ping = await pool.query("SELECT 1 AS ok");
    expect(ping.rows[0]?.["ok"]).toBe(1);
  });
});
