import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertBoundedDateRange,
  parseYyyymmddDate,
} from "../src/bound-dates.js";

describe("bound dates", () => {
  it("parses valid YYYYMMDD", () => {
    const date = parseYyyymmddDate("20240615", "Start");
    expect(date.toISOString().startsWith("2024-06-15")).toBe(true);
  });

  it("rejects invalid calendar date", () => {
    expect(() => parseYyyymmddDate("20240231", "Start")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects lookback beyond 90 days", () => {
    expect(() => assertBoundedDateRange("20240101", "20240501", 90)).toThrow(
      ConnectorSdkError,
    );
  });
});
