import { describe, expect, it } from "vitest";

import { POSTGRES_QUERY_READ_TOOL } from "../src/constants.js";
import { createPostgresConnector } from "../src/connector.js";
import { normalizeReadQueryResult } from "../src/query-read/normalize-result.js";
import { createMockPostgresDatabase } from "./helpers/mock-postgres-database.js";
import { defaultConnectorOptions } from "./helpers/test-config.js";

describe("postgres.query.read", () => {
  it("returns positional rows aligned with duplicate column names", async () => {
    const database = createMockPostgresDatabase({
      runReadOnlySelect: async () => ({
        columns: [
          { name: "id", dataType: "integer" },
          { name: "id", dataType: "integer" },
        ],
        rows: [
          [1, 2],
          [3, 4],
        ],
        rowCount: 2,
        truncated: false,
      }),
    });
    const connector = createPostgresConnector(
      defaultConnectorOptions(database),
    );
    const tool = connector.tools.find(
      (t) => t.name === POSTGRES_QUERY_READ_TOOL,
    )!;
    const result = await tool.handler(
      { sql: "SELECT 1 AS id, 2 AS id", maxRows: 100 },
      { signal: new AbortController().signal },
    );
    expect(result).toMatchObject({
      rowCount: 2,
      columns: [
        { name: "id", dataType: "integer" },
        { name: "id", dataType: "integer" },
      ],
      rows: [
        [1, 2],
        [3, 4],
      ],
    });
  });

  it("truncates rows beyond maxRows", () => {
    const normalized = normalizeReadQueryResult({
      fields: [
        {
          name: "id",
          dataTypeID: 23,
          tableID: 0,
          columnID: 0,
          dataTypeSize: 4,
          dataTypeModifier: 0,
          format: "text",
        },
      ],
      rows: [[1], [2], [3]],
      maxRows: 2,
    });
    expect(normalized.rowCount).toBe(2);
    expect(normalized.truncated).toBe(true);
  });
});
