/**
 * Emit docs/connector-catalog.json from workspace package manifests.
 * Adoption metadata (tools, install paths, credentials) is derived from
 * authoritative repo sources — not hand-maintained duplicate registries.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MUTATION_INVENTORY } from "./live-provider/mutation-inventory.generated.mjs";
import { CONNECTOR_LIVE_META } from "./live-provider/live-provider-matrix-meta.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACKAGES_DIR = path.join(ROOT, "packages");
const OUT = path.join(ROOT, "docs", "connector-catalog.json");

const SDK_PIN = "1.1.4";

/** @param {string} directory */
function installGuideRelativePath(directory) {
  if (directory === "github") {
    return "docs/INSTALL.md";
  }
  return `docs/INSTALL-${directory.toUpperCase()}.md`;
}

/**
 * @param {string} pkgSrcDir
 * @returns {Promise<string[]>}
 */
async function discoverCredentialEnvNames(pkgSrcDir) {
  const names = new Set();
  const envRe = /"(OSVA_CONNECTOR_[A-Z0-9_]+|GOOGLE_APPLICATION_CREDENTIALS)"/g;

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!/\.(ts|mjs|js)$/.test(entry.name)) {
        continue;
      }
      const text = await fs.readFile(full, "utf8");
      for (const match of text.matchAll(envRe)) {
        names.add(match[1]);
      }
    }
  }

  await walk(pkgSrcDir);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {Record<string, readonly string[]>} toolMap
 */
function classifyTools(toolMap) {
  const readOnly = [];
  const mutationCapable = [];
  for (const [toolName, classes] of Object.entries(toolMap ?? {})) {
    const isReadOnly = classes.length === 1 && classes[0] === "READ_ONLY";
    if (isReadOnly) {
      readOnly.push(toolName);
    } else {
      mutationCapable.push(toolName);
    }
  }
  readOnly.sort();
  mutationCapable.sort();
  return {
    count: readOnly.length + mutationCapable.length,
    readOnly,
    mutationCapable,
  };
}

async function main() {
  const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true });
  const catalog = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = entry.name;
    const pkgRoot = path.join(PACKAGES_DIR, directory);
    const pkgPath = path.join(pkgRoot, "package.json");
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(pkgPath, "utf8"));
    } catch {
      continue;
    }
    const binKeys = Object.keys(manifest.bin ?? {});
    if (binKeys.length !== 1) continue;

    const liveMeta = CONNECTOR_LIVE_META[directory];
    const toolInventory = MUTATION_INVENTORY[directory];
    const tools = classifyTools(toolInventory);

    const installGuide = installGuideRelativePath(directory);
    const installGuideAbs = path.join(ROOT, installGuide);
    let installGuideExists = false;
    try {
      await fs.access(installGuideAbs);
      installGuideExists = true;
    } catch {
      installGuideExists = false;
    }

    const credentialEnv = liveMeta?.requiredEnv?.length
      ? [...liveMeta.requiredEnv].sort()
      : await discoverCredentialEnvNames(path.join(pkgRoot, "src"));

    const acceptanceScript =
      directory === "github"
        ? "scripts/package-acceptance.mjs"
        : `scripts/package-acceptance-${directory}.mjs`;

    catalog.push({
      connectorId: directory,
      connectorKey: binKeys[0],
      npmPackage: manifest.name,
      displayName:
        typeof manifest.description === "string"
          ? manifest.description
          : directory,
      provider: liveMeta?.provider ?? directory,
      directory: `packages/${directory}`,
      repositoryVersion: manifest.version,
      publishedVersion: manifest.version,
      npmPublishStatus: "published",
      sdkVersion: SDK_PIN,
      mcpTransport: "stdio",
      installGuide: installGuideExists ? installGuide : null,
      packageReadme: `packages/${directory}/README.md`,
      authentication: {
        method: liveMeta?.authMethod ?? "See install guide",
        requiredCredentialEnv: credentialEnv,
      },
      tools: {
        ...tools,
      },
      packagedAcceptanceScript: acceptanceScript,
      ciCoverage:
        directory === "github"
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
              ].includes(directory)
            ? "test:package-acceptance:ci-shard-b"
            : `test:package-acceptance:${directory}`,
    });
  }

  catalog.sort((a, b) => a.npmPackage.localeCompare(b.npmPackage));

  const payload = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    connectorCount: catalog.length,
    sdkPin: SDK_PIN,
    connectors: catalog,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${catalog.length} connectors to ${path.relative(ROOT, OUT)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
