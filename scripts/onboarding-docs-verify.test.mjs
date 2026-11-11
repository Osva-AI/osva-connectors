import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const QUICKSTART_GOLDEN = Object.freeze({
  npm: {
    package: "@osva-ai/connector-npm",
    version: "0.1.1",
    tool: "npm_package_metadata",
  },
  github: {
    package: "@osva-ai/connector-github",
    version: "0.4.0",
    tool: "github.repository.get",
  },
  ga4: {
    package: "@osva-ai/connector-ga4",
    version: "0.1.1",
    tool: "ga4.property.list",
  },
});

/** @param {string} rel */
async function readRepoFile(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
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

test("root README reflects 45 published connectors", async () => {
  const readme = await readRepoFile("README.md");
  assert.ok(!/22 are published/i.test(readme));
  assert.ok(!/22 \/ 45/i.test(readme));
  assert.match(readme, /45/);
  assert.match(readme, /connector-catalog\.json/);
  assert.match(readme, /CONNECTOR_QUICKSTART\.md/);
});

test("GitHub install guide pins verified published version 0.4.0", async () => {
  const install = await readRepoFile("docs/INSTALL.md");
  assert.match(install, /@osva-ai\/connector-github@0\.4\.0/);
  assert.ok(!/connector-github@0\.3\.1/.test(install));
});

test("CONNECTOR_QUICKSTART golden paths use safe read-only tools", async () => {
  const doc = await readRepoFile("docs/CONNECTOR_QUICKSTART.md");
  for (const golden of Object.values(QUICKSTART_GOLDEN)) {
    assert.match(
      doc,
      new RegExp(`${golden.package.replace(/\//g, "\\/")}@${golden.version}`),
    );
    assert.match(doc, new RegExp(golden.tool));
  }
  assert.ok(!/"name":\s*"github\.issue\.create"/.test(doc));
  assert.ok(!/"name":\s*"github\.issue\.comment\.create"/.test(doc));
});

test("documentation examples do not embed live credential patterns", async () => {
  const paths = [
    "README.md",
    "docs/CONNECTOR_QUICKSTART.md",
    "docs/INSTALL.md",
    "docs/INSTALL-NPM.md",
    "docs/INSTALL-GA4.md",
  ];
  for (const rel of paths) {
    const text = await readRepoFile(rel);
    assert.ok(!/github_pat_[0-9a-zA-Z]{20,}/.test(text), rel);
    assert.ok(!/"private_key":\s*"/.test(text), rel);
  }
});

test("onboarding docs local markdown links resolve", async () => {
  const docs = [
    "README.md",
    "docs/CONNECTOR_QUICKSTART.md",
    "docs/OSVA_INTEGRATION_GUIDE.md",
  ];
  for (const rel of docs) {
    const text = await readRepoFile(rel);
    for (const target of localMarkdownLinks(text, rel)) {
      const abs = path.join(ROOT, target.replace(/^\//, ""));
      await fs.access(abs);
    }
  }
});

test("compatibility release summary matches B5.6 published inventory", async () => {
  const compatibility = await readRepoFile("docs/compatibility.md");
  assert.ok(
    !/22 \/ 45 connector packages are on the public npm registry/.test(
      compatibility,
    ),
  );
  assert.match(compatibility, /45/);
});
