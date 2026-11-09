import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const files = fs
  .readdirSync(directory)
  .filter((file) => file.endsWith(".test.mjs"))
  .map((file) => path.join(directory, file));

if (files.length === 0) {
  console.error("No release workflow tests found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  shell: false,
});
process.exit(result.status === 0 ? 0 : (result.status ?? 1));
