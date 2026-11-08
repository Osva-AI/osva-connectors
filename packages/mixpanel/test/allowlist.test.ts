import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertResourceAllowed,
  createResourceAllowlist,
} from "../src/allowlist.js";

describe("resource allowlist", () => {
  it("allows when unset", () => {
    expect(() =>
      assertResourceAllowed(undefined, "1", "Bookmark"),
    ).not.toThrow();
  });

  it("denies all when empty", () => {
    const list = createResourceAllowlist([]);
    expect(() => assertResourceAllowed(list, "1", "Funnel")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies ids not in list", () => {
    const list = createResourceAllowlist(["1", "2"]);
    expect(() => assertResourceAllowed(list, "3", "Bookmark")).toThrow(
      ConnectorSdkError,
    );
  });
});
