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

const FORBIDDEN_HTTP_METHODS = [
  'method: "POST"',
  'method: "DELETE"',
  'method: "PUT"',
  'method: "PATCH"',
];

describe("connector-stripe package isolation", () => {
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

describe("Stripe connector architecture", () => {
  it("uses GET-only Stripe REST paths from an allowlisted inventory", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(root, "..", "src", "stripe-rest-client.ts"),
      "utf8",
    );
    for (const forbidden of FORBIDDEN_HTTP_METHODS) {
      expect(source).not.toMatch(new RegExp(forbidden.replace(/"/g, '\\"')));
    }
    expect(source).toMatch(/method:\s*"GET"/);
    expect(source).toContain("/v1/balance_transactions");
    expect(source).toContain("/v1/payment_intents");
    expect(source).not.toContain("Stripe-Account");
  });
});
