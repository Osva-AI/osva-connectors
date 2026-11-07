import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertJqlRespectsProjectAllowlist,
  wrapJqlWithProjectAllowlist,
} from "../src/jql-allowlist.js";

describe("JQL project allowlist", () => {
  const allowed = new Set(["DEMO", "OPS"]);

  it("wraps JQL with project in clause", () => {
    const wrapped = wrapJqlWithProjectAllowlist("status = Open", allowed);
    expect(wrapped).toContain("status = Open");
    expect(wrapped).toContain("project in (DEMO, OPS)");
  });

  it("rejects cross-project references", () => {
    expect(() =>
      assertJqlRespectsProjectAllowlist("project = OTHER", allowed),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects project not in", () => {
    expect(() =>
      assertJqlRespectsProjectAllowlist("project not in (DEMO)", allowed),
    ).toThrow(ConnectorSdkError);
  });
});
