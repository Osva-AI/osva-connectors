import type {
  SnowflakeExecuteOptions,
  SnowflakeProviderClient,
  SnowflakeQueryResult,
} from "../../src/provider-client.js";

type Row = Record<string, unknown>;

export class FakeSnowflakeProviderClient implements SnowflakeProviderClient {
  readonly executed: Array<{ sql: string; binds: readonly unknown[] }> = [];
  private destroyed = false;

  private readonly schemas = [{ SCHEMA_NAME: "APP", SCHEMA_OWNER: "ADMIN" }];
  private readonly tables = [
    { TABLE_NAME: "USERS", TABLE_TYPE: "BASE TABLE", ROW_COUNT: 2, BYTES: 100 },
    {
      TABLE_NAME: "ORDERS",
      TABLE_TYPE: "BASE TABLE",
      ROW_COUNT: 1,
      BYTES: 50,
    },
  ];
  private readonly columns = {
    USERS: [
      {
        COLUMN_NAME: "ID",
        DATA_TYPE: "NUMBER",
        IS_NULLABLE: "NO",
        ORDINAL_POSITION: 1,
      },
      {
        COLUMN_NAME: "EMAIL",
        DATA_TYPE: "TEXT",
        IS_NULLABLE: "YES",
        ORDINAL_POSITION: 2,
      },
      {
        COLUMN_NAME: "CREATED_AT",
        DATA_TYPE: "TIMESTAMP_NTZ",
        IS_NULLABLE: "YES",
        ORDINAL_POSITION: 3,
      },
    ],
    ORDERS: [
      {
        COLUMN_NAME: "ID",
        DATA_TYPE: "NUMBER",
        IS_NULLABLE: "NO",
        ORDINAL_POSITION: 1,
      },
      {
        COLUMN_NAME: "USER_ID",
        DATA_TYPE: "NUMBER",
        IS_NULLABLE: "NO",
        ORDINAL_POSITION: 2,
      },
      {
        COLUMN_NAME: "TOTAL",
        DATA_TYPE: "NUMBER",
        IS_NULLABLE: "YES",
        ORDINAL_POSITION: 3,
      },
    ],
  } as const;

  private readonly sampleRows = {
    USERS: [
      { ID: 1, EMAIL: "a@example.com", CREATED_AT: "2024-01-01" },
      { ID: 2, EMAIL: "b@example.com", CREATED_AT: "2024-02-01" },
    ],
    ORDERS: [{ ID: 10, USER_ID: 1, TOTAL: 42.5 }],
  } as const;

  async execute(
    options: SnowflakeExecuteOptions,
  ): Promise<SnowflakeQueryResult> {
    if (this.destroyed) {
      throw new Error("Connection destroyed");
    }
    this.executed.push({ sql: options.sqlText, binds: options.binds });
    if (options.signal?.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    const sql = options.sqlText.replace(/\s+/g, " ").trim().toUpperCase();
    const binds = options.binds;

    if (sql.includes("FROM INFORMATION_SCHEMA.SCHEMATA")) {
      return this.paginate(this.schemas, binds);
    }
    if (
      sql.includes("FROM INFORMATION_SCHEMA.TABLES") &&
      sql.includes("TABLE_NAME")
    ) {
      if (sql.includes("ROW_COUNT")) {
        const table = String(binds[2]);
        const row = this.tables.find((t) => t.TABLE_NAME === table);
        return this.single(row ? [row] : []);
      }
      return this.paginate(this.tables, binds);
    }
    if (sql.includes("FROM INFORMATION_SCHEMA.COLUMNS")) {
      const table = String(binds[2]);
      const cols = this.columns[table as keyof typeof this.columns] ?? [];
      return this.paginate([...cols], binds);
    }
    if (sql.startsWith("SELECT ") && sql.includes(" FROM ")) {
      const tableMatch = options.sqlText.match(
        /\.\"([A-Za-z_][A-Za-z0-9_$]*)\"\s*(?:WHERE|ORDER|LIMIT|$)/,
      );
      const table = tableMatch?.[1] ?? "USERS";
      const rows = this.sampleRows[table as keyof typeof this.sampleRows] ?? [];
      const offset = Number(binds.at(-1) ?? 0);
      const limit = Number(binds.at(-2) ?? options.maxRows);
      const slice = rows.slice(offset, offset + limit);
      return {
        columns: Object.keys(slice[0] ?? {}).map((name) => ({ name })),
        rows: slice as Row[],
        rowCount: slice.length,
      };
    }
    return { columns: [], rows: [], rowCount: 0 };
  }

  private paginate(
    rows: readonly Row[],
    binds: readonly (string | number | boolean | null)[],
  ): SnowflakeQueryResult {
    const limit = Number(binds.at(-2) ?? 20);
    const offset = Number(binds.at(-1) ?? 0);
    const slice = rows.slice(offset, offset + limit);
    return {
      columns: Object.keys(slice[0] ?? { X: 1 }).map((name) => ({ name })),
      rows: [...slice],
      rowCount: slice.length,
    };
  }

  private single(rows: readonly Row[]): SnowflakeQueryResult {
    return {
      columns: Object.keys(rows[0] ?? {}).map((name) => ({ name })),
      rows: [...rows],
      rowCount: rows.length,
    };
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
  }
}
