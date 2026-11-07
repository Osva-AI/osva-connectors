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
  "@linear/sdk",
];

describe("connector-linear package isolation", () => {
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

  it("stdio entry has shebang", () => {
    const stdioPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../src/stdio.ts",
    );
    const head = readFileSync(stdioPath, "utf8").split("\n", 1)[0];
    expect(head).toBe("#!/usr/bin/env node");
  });
});

describe("Linear connector architecture", () => {
  it("uses POST only against the GraphQL endpoint", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(root, "..", "src", "linear-graphql-client.ts"),
      "utf8",
    );
    expect(source).toMatch(/method:\s*"POST"/);
    expect(source).not.toMatch(/method:\s*"GET"/);
    expect(source).toContain("/graphql");
  });

  it("does not expose arbitrary GraphQL execution tools", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const connectorSource = readFileSync(
      join(root, "..", "src", "connector.ts"),
      "utf8",
    );
    expect(connectorSource).not.toMatch(/linear\.graphql/i);
    expect(connectorSource).not.toMatch(/executeGraphql/);
    expect(connectorSource).not.toMatch(/query:\s*input/);
  });
});
