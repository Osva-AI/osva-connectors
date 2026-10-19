import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACKAGES_DIR = path.join(ROOT, "packages");

const FORBIDDEN_DEPENDENCIES = [
  "@osva/db",
  "@osva/domain",
  "@osva/orchestration",
];

async function checkPackage(packageDir) {
  const packageJsonPath = path.join(packageDir, "package.json");
  const manifest = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const names = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];

  for (const forbidden of FORBIDDEN_DEPENDENCIES) {
    if (names.includes(forbidden)) {
      console.error(`${manifest.name}: forbidden dependency ${forbidden}`);
      process.exit(1);
    }
  }

  for (const name of names) {
    if (name.startsWith("@osva/") && !name.startsWith("@osva-ai/")) {
      console.error(`${manifest.name}: forbidden monorepo dependency ${name}`);
      process.exit(1);
    }
  }
}

const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) {
    continue;
  }
  const packageDir = path.join(PACKAGES_DIR, entry.name);
  const packageJsonPath = path.join(packageDir, "package.json");
  try {
    await fs.access(packageJsonPath);
  } catch {
    continue;
  }
  await checkPackage(packageDir);
}

console.log("Package boundary check passed.");
