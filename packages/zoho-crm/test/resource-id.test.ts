import { describe, expect, it } from "vitest";
import { coerceZohoIdField, parseZohoRecordId } from "../src/resource-id.js";

describe("Zoho record ids", () => {
  it("parses numeric strings", () => {
    expect(parseZohoRecordId("9001000000001001", "Deal id")).toBe(
      "9001000000001001",
    );
  });

  it("rejects non-digit ids", () => {
    expect(() => parseZohoRecordId("deal-abc", "Deal id")).toThrow();
  });

  it("never coerces JavaScript numbers", () => {
    expect(coerceZohoIdField(9001000000001001)).toBeUndefined();
    expect(coerceZohoIdField(42)).toBeUndefined();
  });
});
