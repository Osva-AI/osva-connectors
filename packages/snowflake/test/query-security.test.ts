import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertSelectOnly,
  buildSampleSelectQuery,
} from "../src/query-builder.js";

describe("query security (snowflake)", () => {
  it("rejects non-SELECT SQL", () => {
    expect(() => assertSelectOnly("DELETE FROM t")).toThrow(ConnectorSdkError);
  });

  it("builds parameterized SELECT with quoted identifiers", () => {
    const built = buildSampleSelectQuery({
      database: "DB1",
      schema: "APP",
      table: "USERS",
      columns: ["ID", "EMAIL"],
      filters: [{ column: "ID", op: "eq", value: 1 }],
      limit: 10,
      offset: 0,
    });
    expect(built.sqlText).toContain("SELECT");
    expect(built.sqlText).toContain('"APP"."USERS"');
    expect(built.sqlText).not.toContain("DELETE");
    expect(built.binds).toContain(1);
  });
});
