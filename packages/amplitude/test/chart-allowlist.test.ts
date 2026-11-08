import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertChartAllowed,
  createChartAllowlist,
} from "../src/chart-allowlist.js";

describe("chart allowlist", () => {
  it("denies empty allowlist", () => {
    const allowlist = createChartAllowlist([]);
    expect(() => assertChartAllowed(allowlist, "abc")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies unknown chart", () => {
    const allowlist = createChartAllowlist(["allowed"]);
    expect(() => assertChartAllowed(allowlist, "other")).toThrow(
      ConnectorSdkError,
    );
  });

  it("allows listed chart", () => {
    const allowlist = createChartAllowlist(["allowed"]);
    expect(() => assertChartAllowed(allowlist, "allowed")).not.toThrow();
  });
});
