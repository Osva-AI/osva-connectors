import Cursor from "pg-cursor";
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
    totalTimeoutMs: 60_000,
    poolMax: 2,
    ...overrides,
  };
}

const SAMPLE_FIELD = {
  name: "x",
  dataTypeID: 23,
  tableID: 0,
  columnID: 0,
  dataTypeSize: 4,
  dataTypeModifier: 0,
  format: "text",
};

function attachCursorBehavior(cursor: Cursor) {
  Object.assign(cursor, {
    read: vi.fn(async () => [[42]]),
    close: vi.fn(async () => undefined),
    _result: { fields: [SAMPLE_FIELD] },
  });
  return cursor;
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
    const database = createPgDatabase(pool as never, sampleConfig());
    const result = await database.query("SELECT 1", []);
    expect(result.rows[0]).toEqual({ server_version: "16" });
  });

  it("ends the pool on shutdown", async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      end: vi.fn(async () => undefined),
    };
    const database = createPgDatabase(pool as never, sampleConfig());
    await database.end();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it("runs read-only SELECT through a cursor on one checked-out client", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn((submitted: Cursor | string) => {
        if (typeof submitted === "string") {
          queries.push(submitted);
          return submitted;
        }
        queries.push("CURSOR");
        return attachCursorBehavior(submitted);
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => client),
      end: vi.fn(async () => undefined),
    };
    const database = createPgDatabase(pool as never, sampleConfig());
    const result = await database.runReadOnlySelect({
      sql: "SELECT $1::int AS x",
      params: [1],
      maxRows: 10,
      statementTimeoutMs: 1_000,
      lockTimeoutMs: 1_000,
      totalTimeoutMs: 60_000,
    });
    expect(queries[0]).toBe("BEGIN READ ONLY");
    expect(queries.some((q) => q.includes("statement_timeout"))).toBe(true);
    expect(queries).toContain("CURSOR");
    expect(result.rowCount).toBe(1);
    expect(client.release).toHaveBeenCalledWith();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("destroys the client when cleanup fails after a query error", async () => {
    const client = {
      query: vi.fn((submitted: Cursor | string) => {
        if (typeof submitted === "string") {
          if (submitted === "ROLLBACK") {
            throw new Error("rollback failed");
          }
          return submitted;
        }
        const cursor = attachCursorBehavior(submitted);
        cursor.read = vi.fn(async () => {
          throw new Error("query failed");
        });
        return cursor;
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
      end: vi.fn(async () => undefined),
    };
    const database = createPgDatabase(pool as never, sampleConfig());
    await expect(
      database.runReadOnlySelect({
        sql: "SELECT 1",
        params: [],
        maxRows: 1,
        statementTimeoutMs: 1_000,
        lockTimeoutMs: 1_000,
        totalTimeoutMs: 60_000,
      }),
    ).rejects.toThrow();
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it("rejects when the MCP signal is already aborted", async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      end: vi.fn(async () => undefined),
    };
    const database = createPgDatabase(pool as never, sampleConfig());
    const controller = new AbortController();
    controller.abort();
    await expect(
      database.query("SELECT 1", [], { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
