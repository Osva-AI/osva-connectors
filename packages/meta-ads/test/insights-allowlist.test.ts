import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  parseBreakdownInput,
  validateBreakdownSelection,
} from "../src/insights-allowlist.js";

describe("breakdown allowlist", () => {
  it("accepts supported breakdowns", () => {
    expect(parseBreakdownInput("age")).toEqual(["age"]);
    validateBreakdownSelection(["publisher_platform", "platform_position"]);
  });

  it("rejects incompatible pairs", () => {
    expect(() =>
      validateBreakdownSelection(["age", "publisher_platform"]),
    ).toThrow(ConnectorSdkError);
  });
});
