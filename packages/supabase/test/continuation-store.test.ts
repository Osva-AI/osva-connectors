import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { ContinuationStore } from "../src/continuation-store.js";
import { CONNECTOR_KEY } from "../src/constants.js";

describe("ContinuationStore (supabase rows.list)", () => {
  it("issues and resolves matching scope", () => {
    const store = new ContinuationStore();
    const scope = {
      connectorKey: CONNECTOR_KEY,
      family: "table.rows.list" as const,
      schema: "public",
      table: "users",
      pageSize: 10,
      filterFingerprint: "[]",
      orderFingerprint: "null",
    };
    const token = store.issue(scope, 10);
    expect(store.resolve(token, scope)).toBe(10);
  });

  it("rejects scope mismatch", () => {
    const store = new ContinuationStore();
    const scope = {
      connectorKey: CONNECTOR_KEY,
      family: "table.rows.list" as const,
      schema: "public",
      table: "users",
      pageSize: 10,
      filterFingerprint: "[]",
      orderFingerprint: "null",
    };
    const token = store.issue(scope, 10);
    expect(() => store.resolve(token, { ...scope, pageSize: 20 })).toThrow(
      ConnectorSdkError,
    );
  });
});
