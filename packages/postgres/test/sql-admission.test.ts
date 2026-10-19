import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { assertReadOnlySelectSql } from "../src/query-read/sql-admission.js";

describe("assertReadOnlySelectSql", () => {
  it("accepts a simple parameterized SELECT", () => {
    expect(() =>
      assertReadOnlySelectSql("SELECT id FROM app.users WHERE id = $1", 1),
    ).not.toThrow();
  });

  it("accepts semicolons inside string literals", () => {
    expect(() =>
      assertReadOnlySelectSql("SELECT ';' AS marker", 0),
    ).not.toThrow();
  });

  it("rejects dollar-quoted SQL the parser cannot represent safely", () => {
    expect(() =>
      assertReadOnlySelectSql("SELECT $$a; b$$ AS marker", 0),
    ).toThrow(ConnectorSdkError);
  });

  it("accepts nested read-only CTEs", () => {
    expect(() =>
      assertReadOnlySelectSql(
        "WITH a AS (SELECT 1 AS n), b AS (SELECT n + 1 AS n FROM a) SELECT n FROM b",
        0,
      ),
    ).not.toThrow();
  });

  it("rejects multiple statements", () => {
    expect(() => assertReadOnlySelectSql("SELECT 1; SELECT 2", 0)).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects INSERT statements", () => {
    expect(() =>
      assertReadOnlySelectSql("INSERT INTO app.users VALUES (1)", 0),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects data-modifying CTEs", () => {
    expect(() =>
      assertReadOnlySelectSql(
        "WITH d AS (DELETE FROM app.users RETURNING *) SELECT * FROM d",
        0,
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects SELECT INTO", () => {
    expect(() =>
      assertReadOnlySelectSql("SELECT id INTO TEMP t FROM app.users", 0),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects SELECT FOR UPDATE and FOR SHARE", () => {
    expect(() =>
      assertReadOnlySelectSql("SELECT * FROM app.users FOR UPDATE", 0),
    ).toThrow(ConnectorSdkError);
    expect(() =>
      assertReadOnlySelectSql("SELECT * FROM app.users FOR SHARE", 0),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects when placeholders exceed params", () => {
    expect(() => assertReadOnlySelectSql("SELECT $1, $2", 1)).toThrow(
      ConnectorSdkError,
    );
  });

  it("accepts unused extra parameters", () => {
    expect(() => assertReadOnlySelectSql("SELECT $1", 2)).not.toThrow();
  });
});
