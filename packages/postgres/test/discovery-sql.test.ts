import { describe, expect, it } from "vitest";

import {
  COLUMN_LIST_SQL,
  SCHEMA_LIST_SQL,
  TABLE_LIST_SQL,
} from "../src/discovery/queries.js";

describe("discovery SQL contracts", () => {
  it("enforces schema USAGE and system-schema exclusion", () => {
    expect(SCHEMA_LIST_SQL).toContain("has_schema_privilege");
    expect(SCHEMA_LIST_SQL).toContain("n.nspname <> 'information_schema'");
    expect(SCHEMA_LIST_SQL).toContain("NOT LIKE 'pg_%'");
  });

  it("requires table or column SELECT for relation discovery", () => {
    expect(TABLE_LIST_SQL).toContain("has_table_privilege(c.oid, 'SELECT')");
    expect(TABLE_LIST_SQL).toContain(
      "has_column_privilege(c.oid, col_a.attnum, 'SELECT')",
    );
    expect(TABLE_LIST_SQL).toContain("'materialized_view'");
  });

  it("requires column SELECT per attribute", () => {
    expect(COLUMN_LIST_SQL).toContain(
      "has_column_privilege(c.oid, a.attnum, 'SELECT')",
    );
    expect(COLUMN_LIST_SQL).not.toContain(
      "has_table_privilege(c.oid, 'SELECT')",
    );
  });
});
