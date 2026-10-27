import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Meta Ads connector architecture", () => {
  it("does not expose mutation HTTP methods in client", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(root, "..", "src", "meta-graph-client.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/method:\s*"POST"/);
    expect(source).not.toMatch(/method:\s*"DELETE"/);
  });
});
