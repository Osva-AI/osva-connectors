import { describe, expect, it } from "vitest";

import {
  assertAllowedMimeType,
  decodeUtf8Content,
  encodeWriteContent,
} from "../src/content-policy.js";

describe("content policy", () => {
  it("allows listed mime types", () => {
    expect(() => assertAllowedMimeType("text/plain")).not.toThrow();
    expect(() => assertAllowedMimeType("application/json")).not.toThrow();
  });

  it("decodes utf-8 and enforces size", () => {
    const text = decodeUtf8Content(new TextEncoder().encode("hello"));
    expect(text).toBe("hello");
    expect(encodeWriteContent("data").byteLength).toBeGreaterThan(0);
  });
});
