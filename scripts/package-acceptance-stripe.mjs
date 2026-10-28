/**
 * K1: pack @osva-ai/connector-stripe, install in an isolated project, run MCP smoke tests.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NPM_BIN_STRIP_PATTERN_STRIPE,
  runNpmPublishDryRunForAcceptance,
} from "./package-acceptance-npm-dry-run.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PKG_DIR = path.join(ROOT, "packages", "stripe");
const FAKE_TOKEN_PATTERN = /(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]{20,}/;

const FORBIDDEN_TARBALL_PATHS = [
  /^package\/test\//,
  /^package\/\.env$/,
  /^package\/.*\.env$/,
  /^package\/test\/fixtures\//,
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

function runNpm(args, cwd) {
  return run("npm", args, {
    cwd,
    shell: process.platform === "win32",
  });
}

function runNode(args, cwd) {
  return run(process.execPath, args, { cwd, shell: false });
}

async function listTarEntries(tarballPath) {
  if (process.platform === "win32") {
    const result = spawnSync("tar", ["-tzf", tarballPath], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`tar -tzf failed: ${result.stderr}`);
    }
    return result.stdout.trim().split(/\r?\n/).filter(Boolean);
  }
  const result = run("tar", ["-tzf", tarballPath]);
  return result.stdout.trim().split("\n").filter(Boolean);
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
  if (manifest.name !== "@osva-ai/connector-stripe") {
    throw new Error(`Unexpected package name: ${manifest.name}`);
  }
  if (!manifest.bin?.["osva-connector-stripe"]) {
    throw new Error(
      "Missing osva-connector-stripe bin entry in packed manifest.",
    );
  }
  if (manifest.engines?.node !== ">=24") {
    throw new Error(`Unexpected engines.node: ${manifest.engines?.node}`);
  }
}

function readTarballFile(tarballPath, entryPath) {
  const result = spawnSync("tar", ["-xOf", tarballPath, entryPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Failed to read ${entryPath} from tarball: ${result.stderr}`,
    );
  }
  return result.stdout;
}

async function readPackedManifest(tarballPath) {
  return JSON.parse(readTarballFile(tarballPath, "package/package.json"));
}

function assertPackedBinMetadata(manifest, tarballPath) {
  const binPath = manifest.bin?.["osva-connector-stripe"];
  if (binPath !== EXPECTED_BIN_PATH) {
    throw new Error(
      `Packed manifest bin must be "${EXPECTED_BIN_PATH}" (got ${JSON.stringify(binPath)}).`,
    );
  }
  if (binPath.startsWith("./") || binPath.includes("\\")) {
    throw new Error(`Invalid bin path in packed manifest: ${binPath}`);
  }
  const stdioSource = readTarballFile(tarballPath, "package/dist/stdio.js");
  const firstLine = stdioSource.split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine.startsWith("#!")) {
    throw new Error("Packed dist/stdio.js is missing a shebang line.");
  }
  if (!/node/i.test(firstLine)) {
    throw new Error(
      `Packed dist/stdio.js shebang must reference node: ${firstLine}`,
    );
  }
}

async function main() {
  console.log("package-acceptance-stripe: building production package…");
  runPnpm(["--filter", "@osva-ai/connector-stripe", "build"], ROOT);

  const workRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-connector-stripe-acceptance-"),
  );
  const packDir = path.join(workRoot, "pack");
  const installDir = path.join(workRoot, "install");
  await fs.mkdir(packDir, { recursive: true });
  await fs.mkdir(installDir, { recursive: true });

  try {
    if (path.resolve(workRoot).startsWith(path.resolve(ROOT))) {
      throw new Error("Acceptance install dir must be outside the repository.");
    }

    console.log("package-acceptance-stripe: creating tarball…");
    runPnpm(["pack", "--pack-destination", packDir], PKG_DIR);

    const packFiles = await fs.readdir(packDir);
    const tarballName = packFiles.find((f) => f.endsWith(".tgz"));
    if (tarballName === undefined) {
      throw new Error("No .tgz produced by pnpm pack.");
    }
    const tarballPath = path.join(packDir, tarballName);
    console.log(`package-acceptance-stripe: tarball ${tarballName}`);

    const manifest = await readPackedManifest(tarballPath);
    const entries = await listTarEntries(tarballPath);
    inspectTarballContents(entries, manifest);
    assertPackedBinMetadata(manifest, tarballPath);
    console.log(
      "package-acceptance-stripe: packed bin metadata and shebang verified",
    );

    console.log(
      "package-acceptance-stripe: npm publish --dry-run (bin normalization)…",
    );
    const dryRun = runNpmPublishDryRunForAcceptance(
      PKG_DIR,
      NPM_BIN_STRIP_PATTERN_STRIPE,
    );
    if (dryRun === "version_already_published") {
      console.log(
        "package-acceptance-stripe: registry already has this version (acceptable)",
      );
    }
    console.log(
      `package-acceptance-stripe: ${entries.length} tarball entries verified`,
    );

    await fs.writeFile(
      path.join(installDir, "package.json"),
      `${JSON.stringify(
        {
          name: "osva-connector-stripe-acceptance",
          private: true,
          type: "module",
          description: "Isolated install smoke test (gsc K1)",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    console.log("package-acceptance-stripe: npm install tarball + MCP client…");
    runNpm(
      [
        "install",
        tarballPath,
        "@modelcontextprotocol/client@2.0.0",
        "--omit=dev",
        "--no-fund",
        "--no-audit",
      ],
      installDir,
    );

    const installedPkg = path.join(
      installDir,
      "node_modules",
      "@osva-ai/connector-stripe",
      "package.json",
    );
    const installedRaw = await fs.readFile(installedPkg, "utf8");
    if (FAKE_TOKEN_PATTERN.test(installedRaw)) {
      throw new Error("Hardcoded credentials in installed package.json");
    }

    const binPath = path.join(
      installDir,
      "node_modules",
      ".bin",
      process.platform === "win32"
        ? "osva-connector-stripe.cmd"
        : "osva-connector-stripe",
    );
    await fs.access(binPath);

    const smokeScript = path.join(
      installDir,
      "package-acceptance-stripe-smoke.mjs",
    );
    await fs.copyFile(
      path.join(ROOT, "scripts", "package-acceptance-stripe-smoke.mjs"),
      smokeScript,
    );

    console.log("package-acceptance-stripe: running MCP smoke…");
    runNode([smokeScript], installDir);

    console.log("package-acceptance-stripe: all checks passed");
    console.log(`  tarball: ${tarballPath}`);
    console.log(`  install: ${installDir}`);
  } finally {
    if (process.env.OSVA_KEEP_ACCEPTANCE_DIR !== "1") {
      await fs.rm(workRoot, { recursive: true, force: true });
    } else {
      console.log(`package-acceptance-stripe: kept ${workRoot}`);
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
