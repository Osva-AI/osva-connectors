/**
 * Ensures every published connector has a packaged acceptance script and CI coverage.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACKAGES_DIR = path.join(ROOT, "packages");

function slugFromBin(binMap) {
  const keys = Object.keys(binMap ?? {});
  if (keys.length !== 1) {
    return undefined;
  }
  const bin = keys[0];
  return bin.replace(/^osva-connector-/, "");
}

async function discoverConnectors() {
  const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true });
  const connectors = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = path.join(PACKAGES_DIR, entry.name, "package.json");
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    } catch {
      continue;
    }
    const slug = slugFromBin(manifest.bin);
    if (slug === undefined) {
      continue;
    }
    connectors.push({
      slug,
      dir: entry.name,
      name: manifest.name,
    });
  }
  connectors.sort((a, b) => a.slug.localeCompare(b.slug));
  return connectors;
}

function acceptanceScriptForSlug(slug) {
  if (slug === "github") {
    return path.join(ROOT, "scripts", "package-acceptance.mjs");
  }
  return path.join(ROOT, "scripts", `package-acceptance-${slug}.mjs`);
}

function pnpmScriptForSlug(slug) {
  if (slug === "github") {
    return "test:package-acceptance";
  }
  return `test:package-acceptance:${slug}`;
}

async function loadRootManifest() {
  return JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
}

async function loadCiWorkflow() {
  return fs.readFile(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
}

function ciInvokesScript(ciYaml, pnpmScript) {
  return (
    ciYaml.includes(`pnpm ${pnpmScript}`) ||
    ciYaml.includes(`run: ${pnpmScript}`) ||
    ciYaml.includes(pnpmScript)
  );
}

async function main() {
  const [connectors, rootManifest, ciYaml] = await Promise.all([
    discoverConnectors(),
    loadRootManifest(),
    loadCiWorkflow(),
  ]);

  if (connectors.length !== 45) {
    console.error(
      `Expected 45 connector packages, found ${connectors.length}.`,
    );
    process.exit(1);
  }

  const shardBPresent =
    ciYaml.includes("ci-package-acceptance-shard-b.mjs") ||
    ciYaml.includes("test:package-acceptance:ci-shard-b");
  const shardBSlugs = new Set([
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
  ]);

  let failed = false;

  for (const connector of connectors) {
    const scriptPath = acceptanceScriptForSlug(connector.slug);
    const pnpmScript = pnpmScriptForSlug(connector.slug);

    try {
      await fs.access(scriptPath);
    } catch {
      console.error(
        `${connector.name}: missing acceptance script ${path.relative(ROOT, scriptPath)}`,
      );
      failed = true;
    }

    if (!rootManifest.scripts?.[pnpmScript]) {
      console.error(
        `${connector.name}: missing root package.json script ${pnpmScript}`,
      );
      failed = true;
    }

    const inCi =
      ciInvokesScript(ciYaml, pnpmScript) ||
      (shardBPresent && shardBSlugs.has(connector.slug));
    const postgresJob =
      connector.slug === "postgres" &&
      ciYaml.includes("test:package-acceptance:postgres");

    if (!inCi && !postgresJob) {
      console.error(
        `${connector.name}: packaged acceptance not referenced in CI (${pnpmScript})`,
      );
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log(
    `Package acceptance coverage check passed (${connectors.length} connectors).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
