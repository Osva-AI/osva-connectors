import { describe, expect, it, vi } from "vitest";

import {
  createPgDatabase,
  createPostgresPoolConfig,
} from "../src/postgres-client.js";
import type { PostgresConfig } from "../src/schemas.js";

function sampleConfig(overrides: Partial<PostgresConfig> = {}): PostgresConfig {
  return {
    connectionUrl: "postgresql://reader@127.0.0.1:5432/app",
    sslMode: "disable",
    connectTimeoutMs: 5_000,
    queryTimeoutMs: 12_000,
    poolMax: 2,
    ...overrides,
  };
}

describe("createPostgresPoolConfig", () => {
  it("sets server-side statement_timeout and connection acquisition timeout", () => {
    const poolConfig = createPostgresPoolConfig(
      sampleConfig({ queryTimeoutMs: 9_000, connectTimeoutMs: 4_000 }),
    );
    expect(poolConfig.statement_timeout).toBe(9_000);
    expect(poolConfig.connectionTimeoutMillis).toBe(4_000);
  });
});

describe("createPgDatabase", () => {
  it("returns query results from the pool", async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [{ server_version: "16" }] })),
      end: vi.fn(async () => undefined),
    };
    const database = createPgDatabase(pool as never);
    const result = await database.query("SELECT 1", []);
    expect(result.rows[0]).toEqual({ server_version: "16" });
  });

  it("ends the pool on shutdown", async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      end: vi.fn(async () => undefined),
    };
    const database = createPgDatabase(pool as never);
    await database.end();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it("rejects when the MCP signal is already aborted", async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      end: vi.fn(async () => undefined),
    };
    const database = createPgDatabase(pool as never);
    const controller = new AbortController();
    controller.abort();
    await expect(
      database.query("SELECT 1", [], { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
