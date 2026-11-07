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
  "@mendable/firecrawl-js",
];

describe("connector-firecrawl package isolation", () => {
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

describe("Firecrawl connector architecture", () => {
  it("does not expose interact, browser, or webhook tools", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const clientSource = readFileSync(
      join(root, "..", "src", "firecrawl-rest-client.ts"),
      "utf8",
    );
    expect(clientSource).not.toMatch(/\/interact/);
    expect(clientSource).not.toMatch(/\/webhook/);
    expect(clientSource).not.toMatch(/\/agent\//);
  });

  it("uses only bounded Firecrawl v2 scrape/search/map/crawl endpoints", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const clientSource = readFileSync(
      join(root, "..", "src", "firecrawl-rest-client.ts"),
      "utf8",
    );
    expect(clientSource).toContain('apiUrl("/scrape")');
    expect(clientSource).toContain('apiUrl("/search")');
    expect(clientSource).toContain('apiUrl("/map")');
    expect(clientSource).toContain('apiUrl("/crawl")');
    expect(clientSource).toContain("apiUrl(`/crawl/${crawlId}`)");
    expect(clientSource).not.toMatch(/method:\s*"DELETE"/);
  });

  it("does not retry billable POST operations", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const clientSource = readFileSync(
      join(root, "..", "src", "firecrawl-rest-client.ts"),
      "utf8",
    );
    const postBlock = clientSource.slice(
      clientSource.indexOf("async scrape"),
      clientSource.indexOf("async getCrawlStatus"),
    );
    expect(postBlock).toContain("requestJsonAttempt");
    expect(postBlock).not.toContain("requestJson(apiUrl");
  });
});
