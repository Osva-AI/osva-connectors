import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { buildPostgrestFilterQuery } from "../src/postgrest-filters.js";

describe("buildPostgrestFilterQuery", () => {
  const columns = ["id", "email"];

  it("builds eq and in filters", () => {
    const query = buildPostgrestFilterQuery(
      [
        { column: "id", operator: "eq", value: "1" },
        { column: "email", operator: "in", values: ["a@example.com"] },
      ],
      columns,
    );
    expect(query).toContain("id=eq.1");
    expect(query).toContain("email=in.");
  });

  it("rejects non-allowlisted columns", () => {
    expect(() =>
      buildPostgrestFilterQuery(
        [{ column: "secret", operator: "eq", value: "x" }],
        columns,
      ),
    ).toThrow(ConnectorSdkError);
  });
});
