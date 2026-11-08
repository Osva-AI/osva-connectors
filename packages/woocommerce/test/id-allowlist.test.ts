import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertIdAllowed,
  createNumericIdAllowlist,
  filterByNumericAllowlist,
  parseNumericIdList,
} from "../src/id-allowlist.js";

describe("numeric id allowlist", () => {
  it("denies when allowlist is explicitly empty", () => {
    const allowlist = createNumericIdAllowlist([]);
    expect(() => assertIdAllowed(allowlist, 1, "Product")).toThrow(
      ConnectorSdkError,
    );
  });

  it("filters list results by allowlist", () => {
    const allowlist = createNumericIdAllowlist([101]);
    const filtered = filterByNumericAllowlist(
      allowlist,
      [{ id: 101 }, { id: 999 }],
      (item) => item.id,
    );
    expect(filtered).toHaveLength(1);
  });

  it("rejects invalid allowlist entries", () => {
    expect(() => parseNumericIdList("abc")).toThrow(ConnectorSdkError);
  });
});
