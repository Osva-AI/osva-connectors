import { describe, expect, it } from "vitest";

import {
  ContinuationStore,
  queryFingerprint,
} from "../src/continuation-store.js";
import { CONNECTOR_KEY } from "../src/constants.js";

describe("rows.sample pagination", () => {
  it("issues and resolves scoped continuation tokens", () => {
    const store = new ContinuationStore();
    const fp = queryFingerprint("SELECT 1", { a: 1 });
    const scope = {
      connectorKey: CONNECTOR_KEY,
      family: "table.rows.sample" as const,
      datasetId: "analytics",
      tableId: "events",
      pageSize: 10,
      queryFingerprint: fp,
    };
    const token = store.issue(scope, "provider-page-2");
    expect(store.resolve(token, scope)).toBe("provider-page-2");
  });

  it("rejects mismatched continuation scope", () => {
    const store = new ContinuationStore();
    const fp = queryFingerprint("SELECT 1", {});
    const token = store.issue(
      {
        connectorKey: CONNECTOR_KEY,
        family: "table.rows.sample",
        datasetId: "analytics",
        tableId: "events",
        pageSize: 10,
        queryFingerprint: fp,
      },
      "page-2",
    );
    expect(() =>
      store.resolve(token, {
        connectorKey: CONNECTOR_KEY,
        family: "table.rows.sample",
        datasetId: "analytics",
        tableId: "events",
        pageSize: 20,
        queryFingerprint: fp,
      }),
    ).toThrow(/continuation token/i);
  });
});
