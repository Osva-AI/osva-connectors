import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  parseReportTimeframeInput,
  validateReportStatistics,
} from "../src/reporting-allowlist.js";

describe("reporting allowlist", () => {
  it("accepts allowlisted statistics", () => {
    expect(validateReportStatistics(["opens", "open_rate"])).toEqual([
      "opens",
      "open_rate",
    ]);
  });

  it("rejects unknown statistics", () => {
    expect(() => validateReportStatistics(["not_real"])).toThrow(
      ConnectorSdkError,
    );
  });

  it("parses timeframe key or custom range", () => {
    expect(parseReportTimeframeInput({ timeframeKey: "last_30_days" })).toEqual(
      {
        kind: "key",
        key: "last_30_days",
      },
    );
    expect(
      parseReportTimeframeInput({
        start: "2024-01-01T00:00:00+00:00",
        end: "2024-01-31T23:59:59+00:00",
      }),
    ).toMatchObject({ kind: "custom" });
  });
});
