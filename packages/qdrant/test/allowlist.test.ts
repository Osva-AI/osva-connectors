import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertCollectionAllowed,
  createCollectionAllowlist,
  filterCollectionsByAllowlist,
} from "../src/allowlist.js";

describe("collection allowlist", () => {
  it("filters listed collections", () => {
    const allowlist = createCollectionAllowlist(["docs"]);
    const names = filterCollectionsByAllowlist(allowlist, ["docs", "other"]);
    expect(names).toEqual(["docs"]);
  });

  it("denies empty allowlist", () => {
    const allowlist = createCollectionAllowlist([]);
    expect(() => assertCollectionAllowed(allowlist, "docs")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies unknown collection", () => {
    const allowlist = createCollectionAllowlist(["docs"]);
    expect(() => assertCollectionAllowed(allowlist, "secrets")).toThrow(
      ConnectorSdkError,
    );
  });
});
