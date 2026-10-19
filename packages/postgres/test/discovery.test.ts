import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  POSTGRES_COLUMN_LIST_TOOL,
  POSTGRES_SCHEMA_LIST_TOOL,
  POSTGRES_TABLE_LIST_TOOL,
} from "../src/constants.js";
import { createPostgresConnector } from "../src/connector.js";
import type {
  ColumnListOutput,
  SchemaListOutput,
  TableListOutput,
} from "../src/discovery-schemas.js";
import { SCHEMA_LIST_SQL, TABLE_LIST_SQL } from "../src/discovery/queries.js";
import { encodeTableCursor } from "../src/discovery/cursor.js";
import { createMockPostgresDatabase } from "./helpers/mock-postgres-database.js";
import { defaultConnectorOptions } from "./helpers/test-config.js";

describe("postgres discovery tools", () => {
  function connector(allowedSchemas?: readonly string[]) {
    return createPostgresConnector(
      defaultConnectorOptions(createMockPostgresDatabase(), {
        allowedSchemas,
      }),
    );
  }

  function tool(name: string) {
    const c = connector();
    const found = c.tools.find((t) => t.name === name);
    expect(found).toBeDefined();
    return found!;
  }

  it("uses fixed parameterized SQL for schema list", async () => {
    const queries: Array<{
      sql: string;
      values: readonly unknown[] | undefined;
    }> = [];
    const database = createMockPostgresDatabase({
      onQuery: (sql, values) => queries.push({ sql, values }),
    });
    const c = createPostgresConnector(defaultConnectorOptions(database));
    const schemaTool = c.tools.find(
      (t) => t.name === POSTGRES_SCHEMA_LIST_TOOL,
    )!;
    await schemaTool.handler(
      { limit: 10 },
      { signal: new AbortController().signal },
    );
    expect(queries[0]?.sql).toBe(SCHEMA_LIST_SQL);
    expect(queries[0]?.values?.[0]).toBe(11);
    expect(queries[0]?.values?.[1]).toBe("");
    expect(queries[0]?.values?.[2]).toBeNull();
  });

  it("lists schemas with pagination cursor", async () => {
    const schemaTool = tool(POSTGRES_SCHEMA_LIST_TOOL);
    const first = (await schemaTool.handler(
      { limit: 1 },
      { signal: new AbortController().signal },
    )) as SchemaListOutput;
    expect(first.schemas).toHaveLength(1);
    expect(first.nextCursor).toBeDefined();

    const second = (await schemaTool.handler(
      { limit: 1, cursor: first.nextCursor },
      { signal: new AbortController().signal },
    )) as SchemaListOutput;
    expect(second.schemas[0]?.name).not.toBe(first.schemas[0]?.name);
  });

  it("rejects cursor reuse across schemas for table list", async () => {
    const tableTool = tool(POSTGRES_TABLE_LIST_TOOL);
    const page = (await tableTool.handler(
      { schema: "app", limit: 1 },
      { signal: new AbortController().signal },
    )) as TableListOutput;
    expect(page.tables).toHaveLength(1);
    const foreignCursor = encodeTableCursor("other", page.tables[0]!.name);
    await expect(
      tableTool.handler(
        { schema: "app", limit: 1, cursor: foreignCursor },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects SQL injection in schema name", async () => {
    const tableTool = tool(POSTGRES_TABLE_LIST_TOOL);
    await expect(
      tableTool.handler(
        { schema: "app;drop table users" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("enforces connector schema allowlist", async () => {
    const tableTool = connector(["analytics"]).tools.find(
      (t) => t.name === POSTGRES_TABLE_LIST_TOOL,
    )!;
    await expect(
      tableTool.handler(
        { schema: "app" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lists columns with types and nullability", async () => {
    const columnTool = tool(POSTGRES_COLUMN_LIST_TOOL);
    const result = (await columnTool.handler(
      { schema: "app", table: "users" },
      { signal: new AbortController().signal },
    )) as ColumnListOutput;
    expect(result.columns).toEqual([
      {
        name: "id",
        dataType: "integer",
        nullable: false,
        ordinalPosition: 1,
      },
      {
        name: "email",
        dataType: "character varying(255)",
        nullable: true,
        ordinalPosition: 2,
      },
    ]);
  });

  it("uses table list fixed SQL with bound schema parameter", async () => {
    const queries: Array<{
      sql: string;
      values: readonly unknown[] | undefined;
    }> = [];
    const database = createMockPostgresDatabase({
      onQuery: (sql, values) => queries.push({ sql, values }),
    });
    const c = createPostgresConnector(defaultConnectorOptions(database));
    const tableTool = c.tools.find((t) => t.name === POSTGRES_TABLE_LIST_TOOL)!;
    await tableTool.handler(
      { schema: "app" },
      { signal: new AbortController().signal },
    );
    expect(queries[0]?.sql).toBe(TABLE_LIST_SQL);
    expect(queries[0]?.values?.[0]).toBe("app");
  });

  it("rejects malformed provider identifiers", async () => {
    const database = createMockPostgresDatabase({
      onQuery: () => undefined,
    });
    const originalQuery = database.query.bind(database);
    database.query = async (sql, values, options) => {
      if (sql === SCHEMA_LIST_SQL) {
        return { rows: [{ name: "x".repeat(200) }] };
      }
      return originalQuery(sql, values, options);
    };
    const schemaTool = createPostgresConnector(
      defaultConnectorOptions(database),
    ).tools.find((t) => t.name === POSTGRES_SCHEMA_LIST_TOOL)!;
    await expect(
      schemaTool.handler({}, { signal: new AbortController().signal }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });
});
