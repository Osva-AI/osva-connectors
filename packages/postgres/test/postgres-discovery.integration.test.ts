/**
 * Real PostgreSQL integration.
 *
 * Local:
 *   docker compose -f packages/postgres/docker/integration-compose.yml up -d --wait
 *   OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL=postgresql://osva_reader:reader_pass@127.0.0.1:55432/osva_integration
 *
 * CI sets the same URL against the compose service on localhost.
 */
import { afterAll, describe, expect, it } from "vitest";

import { createPostgresConnector } from "../src/connector.js";
import { loadPostgresConfig } from "../src/config.js";
import {
  POSTGRES_COLUMN_LIST_TOOL,
  POSTGRES_SCHEMA_LIST_TOOL,
  POSTGRES_TABLE_LIST_TOOL,
} from "../src/constants.js";
import type {
  ColumnListOutput,
  SchemaListOutput,
  TableListOutput,
} from "../src/discovery-schemas.js";
import {
  createPgDatabase,
  createPostgresPool,
} from "../src/postgres-client.js";
const INTEGRATION_URL = process.env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL;

type TestConnector = ReturnType<typeof createPostgresConnector>;

function buildConnector(allowedSchemas?: readonly string[]): {
  connector: TestConnector;
  close: () => Promise<void>;
} {
  const config = loadPostgresConfig({
    OSVA_CONNECTOR_POSTGRES_URL: INTEGRATION_URL!,
    OSVA_CONNECTOR_POSTGRES_SSL_MODE: "disable",
    ...(allowedSchemas !== undefined
      ? {
          OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS: allowedSchemas.join(","),
        }
      : {}),
  });
  const pool = createPostgresPool(config);
  return {
    connector: createPostgresConnector({
      database: createPgDatabase(pool, config),
      allowedSchemas: config.allowedSchemas,
      queryTimeoutMs: config.queryTimeoutMs,
    }),
    close: async () => {
      await pool.end();
    },
  };
}

function tool(connector: TestConnector, name: string) {
  const found = connector.tools.find((t) => t.name === name);
  if (found === undefined) {
    throw new Error(`Missing tool ${name}`);
  }
  return found;
}

describe.skipIf(INTEGRATION_URL === undefined)(
  "PostgreSQL discovery integration (real privileges)",
  () => {
    const closers: Array<() => Promise<void>> = [];

    afterAll(async () => {
      while (closers.length > 0) {
        const close = closers.pop();
        if (close !== undefined) {
          await close();
        }
      }
    });

    it("lists schemas with USAGE while excluding system and hidden schemas", async () => {
      const { connector, close } = buildConnector(["app"]);
      closers.push(close);
      const result = (await tool(connector, POSTGRES_SCHEMA_LIST_TOOL).handler(
        {},
        { signal: new AbortController().signal },
      )) as SchemaListOutput;
      const names = result.schemas.map((row) => row.name);
      expect(names).toContain("app");
      expect(names).not.toContain("secret");
      expect(names).not.toContain("pg_catalog");
      expect(names).not.toContain("analytics");
    });

    it("excludes schemas outside the connector allowlist even when USAGE is granted", async () => {
      const { connector, close } = buildConnector(["app"]);
      closers.push(close);
      await expect(
        tool(connector, POSTGRES_TABLE_LIST_TOOL).handler(
          { schema: "analytics" },
          { signal: new AbortController().signal },
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("lists only SELECT-visible tables and views", async () => {
      const { connector, close } = buildConnector(["app"]);
      closers.push(close);
      const tables = (await tool(connector, POSTGRES_TABLE_LIST_TOOL).handler(
        { schema: "app" },
        { signal: new AbortController().signal },
      )) as TableListOutput;
      const names = new Set(tables.tables.map((row) => row.name));
      expect(names.has("users")).toBe(true);
      expect(names.has("events_view")).toBe(true);
      expect(names.has("partial_cols")).toBe(true);
      expect(names.has("no_access")).toBe(false);
    });

    it("returns only column-level SELECT authorized columns", async () => {
      const { connector, close } = buildConnector(["app"]);
      closers.push(close);
      const columns = (await tool(connector, POSTGRES_COLUMN_LIST_TOOL).handler(
        { schema: "app", table: "partial_cols" },
        { signal: new AbortController().signal },
      )) as ColumnListOutput;
      expect(columns.columns.map((col) => col.name)).toEqual(["col_a"]);
    });

    it("lists all columns when table-level SELECT is granted", async () => {
      const { connector, close } = buildConnector(["app"]);
      closers.push(close);
      const columns = (await tool(connector, POSTGRES_COLUMN_LIST_TOOL).handler(
        { schema: "app", table: "users" },
        { signal: new AbortController().signal },
      )) as ColumnListOutput;
      expect(columns.columns.map((col) => col.name)).toEqual(["id", "email"]);
    });
  },
);

describe("PostgreSQL discovery integration status", () => {
  it("requires OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL for real-DB tests", () => {
    if (INTEGRATION_URL !== undefined) {
      expect(INTEGRATION_URL.startsWith("postgresql://")).toBe(true);
      return;
    }
    expect(process.env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL).toBeUndefined();
  });
});
