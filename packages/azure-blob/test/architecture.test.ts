import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PACKAGE_JSON = join(
  dirname(fileURLToPath(import.meta.url)),
  "../package.json",
);

describe("connector-azure-blob package isolation", () => {
  it("pins connector-sdk 1.1.4 and includes aws sdk", async () => {
    const manifest = JSON.parse(await fs.readFile(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies?.["@osva-ai/connector-sdk"]).toBe("1.1.4");
    expect(manifest.dependencies?.["@azure/storage-blob"]).toBeDefined();
  });

  it("stdio entry has shebang", () => {
    const stdioPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../src/stdio.ts",
    );
    const head = readFileSync(stdioPath, "utf8").split("\n", 1)[0];
    expect(head).toBe("#!/usr/bin/env node");
  });
});
