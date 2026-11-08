import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("connector-pipedrive package", () => {
  it("stdio has shebang", () => {
    const p = join(dirname(fileURLToPath(import.meta.url)), "../src/stdio.ts");
    expect(readFileSync(p, "utf8").split("\n", 1)[0]).toBe(
      "#!/usr/bin/env node",
    );
  });
});
