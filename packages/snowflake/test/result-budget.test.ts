import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { assertStructuredOutputWithinBudget } from "../src/output-budget.js";

describe("result budget (snowflake)", () => {
  it("rejects oversized structured payloads", () => {
    const huge = { data: "x".repeat(300_000) };
    expect(() => assertStructuredOutputWithinBudget(huge)).toThrow(
      ConnectorSdkError,
    );
  });
});
