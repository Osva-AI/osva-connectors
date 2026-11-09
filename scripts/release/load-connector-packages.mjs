import fs from "node:fs/promises";
import path from "node:path";

export async function loadConnectorPackages(root) {
  const packagesDir = path.join(root, "packages");
  const entries = await fs.readdir(packagesDir, { withFileTypes: true });
  const connectors = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = path.join(packagesDir, entry.name, "package.json");
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    } catch {
      continue;
    }
    if (
      typeof manifest.name !== "string" ||
      !manifest.name.startsWith("@osva-ai/connector-")
    ) {
      continue;
    }
    connectors.push({
      directory: entry.name,
      name: manifest.name,
      version: manifest.version,
      bin: manifest.bin ?? {},
    });
  }

  return connectors.sort((a, b) => a.directory.localeCompare(b.directory));
}

export function expectedWorkflowFileName(directory) {
  return directory === "github"
    ? "npm-release.yml"
    : `npm-release-${directory}.yml`;
}

export function expectedAcceptanceCommand(directory) {
  return directory === "github"
    ? "pnpm test:package-acceptance"
    : `pnpm test:package-acceptance:${directory}`;
}

export function resolveReleaseChecklistFile(docsFiles, directory) {
  if (directory === "github") {
    if (!docsFiles.includes("RELEASE-CHECKLIST.md")) {
      throw new Error("Missing docs/RELEASE-CHECKLIST.md for github.");
    }
    return "docs/RELEASE-CHECKLIST.md";
  }

  const expected = `release-checklist-${directory}.md`;
  const matches = docsFiles.filter(
    (file) => file.toLowerCase() === expected.toLowerCase(),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one release checklist for ${directory}; found ${JSON.stringify(matches)}`,
    );
  }
  return `docs/${matches[0]}`;
}
