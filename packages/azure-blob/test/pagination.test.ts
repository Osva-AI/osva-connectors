import { describe, expect, it } from "vitest";

import { CONNECTOR_KEY } from "../src/constants.js";
import { ContinuationStore } from "../src/continuation-store.js";

describe("ContinuationStore", () => {
  it("binds scope to opaque token", () => {
    const store = new ContinuationStore();
    const scope = {
      connectorKey: CONNECTOR_KEY,
      family: "object.list" as const,
      container: "b",
      prefix: "p/",
      pageSize: 10,
    };
    const token = store.issue(scope, "provider-token-1");
    expect(store.resolve(token, scope)).toBe("provider-token-1");
    expect(() => store.resolve(token, { ...scope, pageSize: 20 })).toThrow();
  });
});
