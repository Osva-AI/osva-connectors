/**
 * Emit docs/connector-catalog.json from workspace package manifests.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACKAGES_DIR = path.join(ROOT, "packages");
const OUT = path.join(ROOT, "docs", "connector-catalog.json");

async function main() {
  const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true });
  const catalog = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgPath = path.join(PACKAGES_DIR, entry.name, "package.json");
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(pkgPath, "utf8"));
    } catch {
      continue;
    }
    const binKeys = Object.keys(manifest.bin ?? {});
    if (binKeys.length !== 1) continue;
    const acceptanceScript =
      entry.name === "github"
        ? "scripts/package-acceptance.mjs"
        : `scripts/package-acceptance-${entry.name}.mjs`;
    catalog.push({
      connectorKey: binKeys[0],
      npmPackage: manifest.name,
      directory: `packages/${entry.name}`,
      repositoryVersion: manifest.version,
      packagedAcceptanceScript: acceptanceScript,
      ciCoverage:
        entry.name === "github"
          ? "test:package-acceptance"
          : [
              "gmail",
              "google-calendar",
              "notion",
              "linear",
              "jira",
              "confluence",
              "outlook",
              "onedrive",
              "teams",
              "exa",
              "tavily",
              "firecrawl",
              "qdrant",
              "pinecone",
              "mixpanel",
              "amplitude",
              "woocommerce",
              "bigcommerce",
            ].includes(entry.name)
            ? "test:package-acceptance:ci-shard-b"
            : `test:package-acceptance:${entry.name}`,
    });
  }
  catalog.sort((a, b) => a.npmPackage.localeCompare(b.npmPackage));
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), connectors: catalog }, null, 2)}\n`, "utf8");
  console.log(`Wrote ${catalog.length} connectors to ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
