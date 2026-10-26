import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertUpdateRangeMatchesMatrix,
  assertValidA1Range,
  rangeDimensions,
} from "../src/a1-range.js";

describe("A1 range validation", () => {
  it("accepts simple and sheet-qualified ranges", () => {
    expect(() => assertValidA1Range("A1")).not.toThrow();
    expect(() => assertValidA1Range("A1:B2")).not.toThrow();
    expect(() => assertValidA1Range("Sheet1!A1:C10")).not.toThrow();
    expect(() => assertValidA1Range("'Sheet Name'!A1")).not.toThrow();
  });

  it("computes range dimensions for update validation", () => {
    expect(rangeDimensions("A1")).toEqual({ rows: 1, columns: 1 });
    expect(rangeDimensions("A1:B2")).toEqual({ rows: 2, columns: 2 });
    expect(() =>
      assertUpdateRangeMatchesMatrix("A1:B2", [
        ["a", "b"],
        ["c", "d"],
      ]),
    ).not.toThrow();
    expect(() => assertUpdateRangeMatchesMatrix("A1:B2", [["a"]])).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects malformed ranges", () => {
    expect(() => assertValidA1Range("")).toThrow(ConnectorSdkError);
    expect(() => assertValidA1Range("A0")).toThrow(ConnectorSdkError);
    expect(() => assertValidA1Range("B2:A1")).toThrow(ConnectorSdkError);
    expect(() => assertValidA1Range("bad!range")).toThrow(ConnectorSdkError);
  });
});
