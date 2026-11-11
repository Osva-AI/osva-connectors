import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { auditInstallGuides } from "./audit-install-guides.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG_PATH = path.join(ROOT, "docs", "connector-catalog.json");

const SOURCE_ONLY =
  /source-only|not yet published on npm|not published yet|not published until bootstrap/i;

const LIVE_SECRET =
  /github_pat_[0-9a-zA-Z]{20,}|"private_key":\s*"[^{]|sk_live_[0-9a-zA-Z]{16,}/;

/** @param {string} rel */
async function readRepoFile(rel) {
  return fs.readFile(rel, "utf8");
}

/** @param {string} text @param {string} rel */
function localMarkdownLinks(text, rel) {
  const dir = path.dirname(rel);
  const links = [];
  for (const match of text.matchAll(/\]\((\.\/[^)]+)\)/g)) {
    links.push(path.normalize(path.join(dir, match[1])));
  }
  return links;
}

/** @param {string} text */
function mcpToolNamesInJsonBlocks(text) {
  const names = [];
  const blocks = text.matchAll(/```json\s*([\s\S]*?)```/g);
  for (const block of blocks) {
    for (const match of block[1].matchAll(
      /"name"\s*:\s*"([a-z][a-z0-9_.]+)"/gi,
    )) {
      if (match[1].includes(".")) {
        names.push(match[1]);
      }
    }
  }
  return names;
}

test("install guides pass catalog-aligned audit", async () => {
  const raw = await fs.readFile(CATALOG_PATH, "utf8");
  const issues = auditInstallGuides(raw);
  assert.deepEqual(
    issues,
    [],
    issues
      .map((i) => `${i.connectorId}: ${i.kind} ${i.detail ?? ""}`)
      .join("\n"),
  );
});

test("published connectors are not labeled source-only in install guides", async () => {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  for (const row of catalog.connectors) {
    if (row.npmPublishStatus !== "published" || !row.installGuide) continue;
    const text = await readRepoFile(path.join(ROOT, row.installGuide));
    assert.ok(
      !SOURCE_ONLY.test(text),
      `${row.installGuide} still contains obsolete source-only language`,
    );
  }
});

test("install guide npm pins match catalog publishedVersion", async () => {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  for (const row of catalog.connectors) {
    if (!row.installGuide) continue;
    const text = await readRepoFile(path.join(ROOT, row.installGuide));
    const pin = `${row.npmPackage}@${row.publishedVersion}`;
    assert.match(
      text,
      new RegExp(pin.replace(/\//g, "\\/")),
      `${row.installGuide} missing pin ${pin}`,
    );
  }
});

test("install guide MCP JSON tool names exist in catalog inventory", async () => {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  for (const row of catalog.connectors) {
    if (!row.installGuide) continue;
    const text = await readRepoFile(path.join(ROOT, row.installGuide));
    const inventory = new Set([
      ...row.tools.readOnly,
      ...row.tools.mutationCapable,
    ]);
    for (const toolName of mcpToolNamesInJsonBlocks(text)) {
      assert.ok(
        inventory.has(toolName),
        `${row.installGuide} references unknown tool ${toolName}`,
      );
    }
  }
});

test("first MCP tools/call example in each install guide is read-only", async () => {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));

  for (const row of catalog.connectors) {
    if (!row.installGuide) continue;
    const text = await readRepoFile(path.join(ROOT, row.installGuide));
    const names = mcpToolNamesInJsonBlocks(text);
    if (names.length === 0) continue;
    const first = names[0];
    const readOnly = new Set(row.tools.readOnly);
    assert.ok(
      readOnly.has(first),
      `${row.installGuide} first tools/call example ${first} is not read-only`,
    );
  }
});

test("install guide local markdown links resolve", async () => {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  for (const row of catalog.connectors) {
    if (!row.installGuide) continue;
    const rel = row.installGuide;
    const text = await readRepoFile(path.join(ROOT, rel));
    for (const target of localMarkdownLinks(text, rel)) {
      const abs = path.join(ROOT, target.replace(/^\//, ""));
      await fs.access(abs);
    }
  }
});

test("install guides avoid live credential patterns", async () => {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  for (const row of catalog.connectors) {
    if (!row.installGuide) continue;
    const text = await readRepoFile(path.join(ROOT, row.installGuide));
    assert.ok(!LIVE_SECRET.test(text), row.installGuide);
  }
});

test("catalog schema v2 retains adoption consumer fields", async () => {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  const keys = new Set();
  for (const row of catalog.connectors) {
    assert.ok(row.connectorKey);
    assert.ok(row.npmPackage);
    assert.ok(row.directory);
    assert.equal(row.repositoryVersion, row.publishedVersion);
    assert.ok(row.packagedAcceptanceScript);
    assert.ok(row.ciCoverage);
    keys.add(row.connectorKey);
    keys.add(row.npmPackage);
  }
  assert.equal(keys.size, catalog.connectors.length * 2);
  assert.equal(catalog.connectors.length, 45);
});
