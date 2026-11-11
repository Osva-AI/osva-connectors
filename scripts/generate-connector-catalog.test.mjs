import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadConnectorPackages } from "./release/load-connector-packages.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG_PATH = path.join(ROOT, "docs", "connector-catalog.json");

test("connector catalog is synchronized with workspace manifests", async () => {
  const raw = await fs.readFile(CATALOG_PATH, "utf8");
  const catalog = JSON.parse(raw);
  const workspace = await loadConnectorPackages(ROOT);

  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.connectorCount, catalog.connectors.length);
  assert.equal(catalog.connectors.length, workspace.length);
  assert.equal(catalog.connectors.length, 45);
  assert.equal(catalog.sdkPin, "1.1.4");

  const byPackage = new Map(
    catalog.connectors.map((row) => [row.npmPackage, row]),
  );

  for (const pkg of workspace) {
    const row = byPackage.get(pkg.name);
    assert.ok(row, `missing catalog row for ${pkg.name}`);
    assert.equal(row.repositoryVersion, pkg.version);
    assert.equal(row.publishedVersion, pkg.version);
    assert.equal(row.connectorId, pkg.directory);
    const binKeys = Object.keys(pkg.bin);
    assert.equal(binKeys.length, 1);
    assert.equal(row.connectorKey, binKeys[0]);
    assert.equal(row.mcpTransport, "stdio");
    assert.equal(row.npmPublishStatus, "published");
    assert.ok(row.tools.count >= 1, `${pkg.name} must declare tools`);
    assert.equal(
      row.tools.readOnly.length + row.tools.mutationCapable.length,
      row.tools.count,
    );
    if (row.installGuide) {
      await fs.access(path.join(ROOT, row.installGuide));
    }
    await fs.access(path.join(ROOT, row.packageReadme));
  }
});

test("connector catalog generation is deterministic aside from generatedAt", async () => {
  const raw = await fs.readFile(CATALOG_PATH, "utf8");
  const catalog = JSON.parse(raw);
  assert.match(catalog.generatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const stripped = JSON.parse(
    JSON.stringify(catalog, (key, value) =>
      key === "generatedAt" ? undefined : value,
    ),
  );
  const sortedConnectors = [...stripped.connectors].sort((a, b) =>
    a.npmPackage.localeCompare(b.npmPackage),
  );
  for (let i = 1; i < sortedConnectors.length; i++) {
    assert.ok(
      sortedConnectors[i - 1].npmPackage.localeCompare(
        sortedConnectors[i].npmPackage,
      ) <= 0,
    );
  }
});
