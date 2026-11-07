import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertIndexAllowed,
  assertNamespaceAllowed,
  createIndexAllowlist,
  createNamespaceAllowlist,
} from "../src/allowlist.js";

describe("pinecone allowlists", () => {
  it("denies empty index allowlist", () => {
    const allowlist = createIndexAllowlist([]);
    expect(() => assertIndexAllowed(allowlist, "docs")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies empty namespace allowlist including default namespace", () => {
    const allowlist = createNamespaceAllowlist([]);
    expect(() => assertNamespaceAllowed(allowlist, undefined)).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies namespace outside allowlist", () => {
    const allowlist = createNamespaceAllowlist(["tenant-a"]);
    expect(() => assertNamespaceAllowed(allowlist, "tenant-b")).toThrow(
      ConnectorSdkError,
    );
  });
});
