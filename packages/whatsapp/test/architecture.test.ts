import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PACKAGE_JSON = join(
  dirname(fileURLToPath(import.meta.url)),
  "../package.json",
);

const FORBIDDEN_DEPENDENCIES = [
  "@osva/db",
  "@osva/domain",
  "@osva/orchestration",
];

describe("connector-whatsapp package isolation", () => {
  it("does not depend on internal OSVA monorepo packages", async () => {
    const manifest = JSON.parse(await fs.readFile(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];

    for (const forbidden of FORBIDDEN_DEPENDENCIES) {
      expect(names).not.toContain(forbidden);
    }

    for (const name of names) {
      if (name.startsWith("@osva/") && !name.startsWith("@osva-ai/")) {
        expect.fail(`Unexpected monorepo dependency: ${name}`);
      }
    }
  });
});

describe("WhatsApp connector architecture", () => {
  it("uses POST only on the messages send path", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(root, "..", "src", "whatsapp-graph-client.ts"),
      "utf8",
    );
    expect(source).toContain('method: "POST"');
    expect(source).not.toMatch(/method:\s*"DELETE"/);
    expect(source).not.toMatch(/method:\s*"PUT"/);
    expect(source).toContain("/messages");
  });
});
