import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import type { FieldDef } from "pg";
import { describe, expect, it, vi } from "vitest";

import { QUERY_READ_FETCH_BATCH_SIZE } from "../src/query-read/constants.js";
import { fetchBoundedReadQueryResult } from "../src/query-read/fetch-bounded-read-query.js";

const SAMPLE_FIELD: FieldDef = {
  name: "id",
  dataTypeID: 23,
  tableID: 0,
  columnID: 0,
  dataTypeSize: 4,
  dataTypeModifier: 0,
  format: "text",
};

function createMockCursor(allRows: unknown[][]) {
  let offset = 0;
  const readCalls: number[] = [];
  const cursor = {
    readCalls,
    async read(count: number) {
      readCalls.push(count);
      const slice = allRows.slice(offset, offset + count);
      offset += slice.length;
      return slice;
    },
    async close() {
      return undefined;
    },
    _result: { fields: [SAMPLE_FIELD] },
  };
  return cursor;
}

describe("fetchBoundedReadQueryResult", () => {
  it("fetches in bounded batches with one-row lookahead", async () => {
    const allRows = Array.from({ length: 200 }, (_, index) => [index + 1]);
    const cursor = createMockCursor(allRows);
    const result = await fetchBoundedReadQueryResult({
      cursor,
      maxRows: 10,
    });
    expect(result.rowCount).toBe(10);
    expect(result.truncated).toBe(true);
    expect(Math.max(...cursor.readCalls)).toBeLessThanOrEqual(
      QUERY_READ_FETCH_BATCH_SIZE,
    );
    expect(
      cursor.readCalls.reduce((sum, value) => sum + value, 0),
    ).toBeLessThan(allRows.length);
    expect(cursor.readCalls.at(-1)).toBe(1);
  });

  it("does not lookahead when the result ends before maxRows", async () => {
    const cursor = createMockCursor([[1], [2], [3]]);
    const result = await fetchBoundedReadQueryResult({
      cursor,
      maxRows: 10,
    });
    expect(result).toMatchObject({ rowCount: 3, truncated: false });
    expect(cursor.readCalls.at(-1)).not.toBe(1);
  });

  it("errors when the first row exceeds the output budget", async () => {
    const huge = "x".repeat(300_000);
    const cursor = createMockCursor([[huge]]);
    await expect(
      fetchBoundedReadQueryResult({ cursor, maxRows: 5 }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("closes are not invoked here (caller owns cursor lifecycle)", async () => {
    const cursor = createMockCursor([[1]]);
    const close = vi.spyOn(cursor, "close");
    await fetchBoundedReadQueryResult({ cursor, maxRows: 5 });
    expect(close).not.toHaveBeenCalled();
  });
});
