import { describe, expect, it } from "vitest";

import {
  encodeColumnCursor,
  parseColumnCursor,
  parseSchemaCursor,
  parseTableCursor,
} from "../src/discovery/cursor.js";

describe("discovery cursors", () => {
  it("parses schema cursors", () => {
    expect(parseSchemaCursor(undefined)).toBe("");
    expect(() => parseSchemaCursor("not-valid")).toThrow();
  });

  it("rejects table cursor schema mismatch", () => {
    const cursor = Buffer.from(
      JSON.stringify({
        v: 1,
        kind: "table",
        schema: "secret",
        after: "t",
      }),
      "utf8",
    ).toString("base64url");
    expect(() => parseTableCursor(cursor, "app")).toThrow();
  });

  it("rejects column cursor table mismatch", () => {
    const cursor = encodeColumnCursor("app", "other", 1);
    expect(() => parseColumnCursor(cursor, "app", "users")).toThrow();
  });
});
