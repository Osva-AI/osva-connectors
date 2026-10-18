import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACKAGE_JSON = path.join(ROOT, "packages/github/package.json");

const FORBIDDEN_DEPENDENCIES = [
  "@osva/db",
  "@osva/domain",
  "@osva/orchestration",
];

const manifest = JSON.parse(await fs.readFile(PACKAGE_JSON, "utf8"));
const names = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
];

for (const forbidden of FORBIDDEN_DEPENDENCIES) {
  if (names.includes(forbidden)) {
    console.error(`Forbidden dependency: ${forbidden}`);
    process.exit(1);
  }
}

for (const name of names) {
  if (name.startsWith("@osva/") && !name.startsWith("@osva-ai/")) {
    console.error(`Forbidden monorepo dependency: ${name}`);
    process.exit(1);
  }
}

console.log("Package boundary check passed.");
