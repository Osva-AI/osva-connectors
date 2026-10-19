/**
 * Pack @osva-ai/connector-postgres, verify tarball boundaries and npm dry-run.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NPM_BIN_STRIP_PATTERN_POSTGRES,
  runNpmPublishDryRunForAcceptance,
} from "./package-acceptance-npm-dry-run.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PKG_DIR = path.join(ROOT, "packages", "postgres");

const FORBIDDEN_TARBALL_PATHS = [
  /^package\/test\//,
  /^package\/\.env$/,
  /^package\/.*\.env$/,
];

const EXPECTED_BIN_PATH = "dist/stdio.js";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr ?? ""}\n${result.stdout ?? ""}`,
    );
  }
  return result;
}

function runPnpm(args, cwd) {
  return run("pnpm", args, {
    cwd,
    shell: process.platform === "win32",
  });
}

async function listTarEntries(tarballPath) {
  const result = spawnSync("tar", ["-tzf", tarballPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`tar -tzf failed: ${result.stderr}`);
  }
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

function inspectTarballContents(entries, manifest) {
  const normalized = entries.map((e) => e.replace(/\\/g, "/"));
  if (!normalized.some((e) => e === "package/package.json")) {
    throw new Error("Tarball missing package/package.json");
  }
  if (!normalized.some((e) => e === "package/LICENSE")) {
    throw new Error("Tarball missing LICENSE");
  }
  if (!normalized.some((e) => e === "package/dist/stdio.js")) {
    throw new Error("Tarball missing dist/stdio.js");
  }
  for (const entry of normalized) {
    for (const forbidden of FORBIDDEN_TARBALL_PATHS) {
      if (forbidden.test(entry)) {
        throw new Error(`Forbidden tarball path: ${entry}`);
      }
    }
  }
  if (manifest.name !== "@osva-ai/connector-postgres") {
    throw new Error(`Unexpected package name: ${manifest.name}`);
  }
  if (!manifest.bin?.["osva-connector-postgres"]) {
    throw new Error("Missing osva-connector-postgres bin entry.");
  }
}

function readTarballFile(tarballPath, entryPath) {
  const result = spawnSync("tar", ["-xOf", tarballPath, entryPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to read ${entryPath}: ${result.stderr}`);
  }
  return result.stdout;
}

async function main() {
  console.log("package-acceptance-postgres: building…");
  runPnpm(["--filter", "@osva-ai/connector-postgres", "build"], ROOT);

  const packDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-connector-postgres-pack-"),
  );
  try {
    runPnpm(["pack", "--pack-destination", packDir], PKG_DIR);
    const tarballName = (await fs.readdir(packDir)).find((f) =>
      f.endsWith(".tgz"),
    );
    if (tarballName === undefined) {
      throw new Error("No tarball produced.");
    }
    const tarballPath = path.join(packDir, tarballName);
    const manifest = JSON.parse(
      readTarballFile(tarballPath, "package/package.json"),
    );
    inspectTarballContents(await listTarEntries(tarballPath), manifest);

    const binPath = manifest.bin?.["osva-connector-postgres"];
    if (binPath !== EXPECTED_BIN_PATH) {
      throw new Error(`Unexpected bin path: ${binPath}`);
    }
    const stdioSource = readTarballFile(tarballPath, "package/dist/stdio.js");
    const firstLine = stdioSource.split(/\r?\n/, 1)[0] ?? "";
    if (!firstLine.startsWith("#!") || !/node/i.test(firstLine)) {
      throw new Error("Invalid stdio shebang.");
    }

    runNpmPublishDryRunForAcceptance(PKG_DIR, NPM_BIN_STRIP_PATTERN_POSTGRES);
    console.log("package-acceptance-postgres: all checks passed");
  } finally {
    await fs.rm(packDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
