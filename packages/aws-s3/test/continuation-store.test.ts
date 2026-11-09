import { describe, expect, it } from "vitest";

import {
  CONNECTOR_KEY,
  DEFAULT_CONTINUATION_TTL_MS,
  MAX_CONTINUATION_STORE_ENTRIES,
} from "../src/constants.js";
import { ContinuationStore } from "../src/continuation-store.js";

const scope = {
  connectorKey: CONNECTOR_KEY,
  family: "object.list" as const,
  bucket: "fixtures-bucket",
  prefix: "docs/",
  pageSize: 20,
};

describe("continuation store security", () => {
  it("issues unpredictable uuid tokens", () => {
    const store = new ContinuationStore();
    const t1 = store.issue(scope, "provider-1");
    const t2 = store.issue(scope, "provider-2");
    expect(t1).not.toBe(t2);
    expect(t1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("binds bucket, prefix, family, and page size", () => {
    const store = new ContinuationStore();
    const token = store.issue(scope, "pt");
    expect(store.resolve(token, scope)).toBe("pt");
    expect(() =>
      store.resolve(token, { ...scope, family: "object.versions.list" }),
    ).toThrow();
    expect(() =>
      store.resolve(token, { ...scope, bucket: "other-bucket" }),
    ).toThrow();
  });

  it("rejects unknown tokens after clear (restart-safe)", () => {
    const store = new ContinuationStore();
    const token = store.issue(
      {
        connectorKey: CONNECTOR_KEY,
        family: "bucket.list",
        prefix: "",
        pageSize: 20,
      },
      "x",
    );
    store.clear();
    expect(() =>
      store.resolve(token, {
        connectorKey: CONNECTOR_KEY,
        family: "bucket.list",
        prefix: "",
        pageSize: 20,
      }),
    ).toThrow();
  });

  it("accepts a valid token before TTL expiry", () => {
    let now = 1_000;
    const store = new ContinuationStore({
      clock: { now: () => now },
      ttlMs: DEFAULT_CONTINUATION_TTL_MS,
    });
    const token = store.issue(scope, "live");
    now += DEFAULT_CONTINUATION_TTL_MS;
    expect(store.resolve(token, scope)).toBe("live");
  });

  it("rejects a token after TTL expiry", () => {
    let now = 0;
    const store = new ContinuationStore({
      clock: { now: () => now },
      ttlMs: DEFAULT_CONTINUATION_TTL_MS,
    });
    const token = store.issue(scope, "stale");
    now += DEFAULT_CONTINUATION_TTL_MS + 1;
    expect(() => store.resolve(token, scope)).toThrow(/invalid or expired/i);
  });

  it("treats the exact TTL boundary as still valid", () => {
    let now = 5_000;
    const ttl = 60_000;
    const store = new ContinuationStore({
      clock: { now: () => now },
      ttlMs: ttl,
    });
    const token = store.issue(scope, "edge");
    now += ttl;
    expect(store.resolve(token, scope)).toBe("edge");
    now += 1;
    expect(() => store.resolve(token, scope)).toThrow();
  });

  it("removes expired entries on access", () => {
    let now = 0;
    const store = new ContinuationStore({
      clock: { now: () => now },
      ttlMs: 1_000,
    });
    const token = store.issue(scope, "gone");
    expect(store.entryCount).toBe(1);
    now += 1_001;
    expect(() => store.resolve(token, scope)).toThrow();
    expect(store.entryCount).toBe(0);
    expect(() => store.resolve(token, scope)).toThrow();
  });

  it("keeps capacity bounded at the configured maximum", () => {
    const store = new ContinuationStore({
      clock: { now: () => 0 },
      ttlMs: DEFAULT_CONTINUATION_TTL_MS,
    });
    for (let i = 0; i < MAX_CONTINUATION_STORE_ENTRIES + 50; i += 1) {
      store.issue(scope, `pt-${i}`);
    }
    expect(store.entryCount).toBe(MAX_CONTINUATION_STORE_ENTRIES);
  });

  it("prunes expired entries on issue without background timers", () => {
    let now = 0;
    const store = new ContinuationStore({
      clock: { now: () => now },
      ttlMs: 100,
    });
    const token = store.issue(scope, "old");
    expect(store.entryCount).toBe(1);
    now += 101;
    store.issue(scope, "new");
    expect(store.entryCount).toBe(1);
    expect(() => store.resolve(token, scope)).toThrow();
    const fresh = store.issue(scope, "newer");
    expect(store.resolve(fresh, scope)).toBe("newer");
  });
});
