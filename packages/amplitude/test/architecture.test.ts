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

describe("connector-amplitude package isolation", () => {
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

    expect(manifest.dependencies?.["@osva-ai/connector-sdk"]).toBe("1.1.4");
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(
      expect.arrayContaining(["@osva-ai/connector-sdk", "zod"]),
    );
  });
});

describe("Amplitude connector architecture", () => {
  it("uses GET only on Dashboard REST paths", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(root, "..", "src", "amplitude-rest-client.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/method:\s*"POST"/);
    expect(source).not.toMatch(/method:\s*"DELETE"/);
    expect(source).not.toMatch(/method:\s*"PUT"/);
    expect(source).not.toMatch(/method:\s*"PATCH"/);
    expect(source).toContain('method: "GET"');
    expect(source).not.toContain("/api/2/usersearch");
    expect(source).not.toContain("/api/2/useractivity");
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
