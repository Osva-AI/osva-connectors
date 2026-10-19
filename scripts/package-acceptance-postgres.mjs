/**
 * P0.5: pack @osva-ai/connector-postgres, install outside the repo, run MCP acceptance
 * against a disposable PostgreSQL 16 fixture when OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL is set.
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
  /^package\/docker\//,
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
  if (manifest.engines?.node !== ">=24") {
    throw new Error(`Unexpected engines.node: ${manifest.engines?.node}`);
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

async function readPackedManifest(tarballPath) {
  return JSON.parse(readTarballFile(tarballPath, "package/package.json"));
}

function assertPackedBinMetadata(manifest, tarballPath) {
  const binPath = manifest.bin?.["osva-connector-postgres"];
  if (binPath !== EXPECTED_BIN_PATH) {
    throw new Error(`Unexpected bin path: ${binPath}`);
  }
  if (binPath.startsWith("./") || binPath.includes("\\")) {
    throw new Error(`Invalid bin path in packed manifest: ${binPath}`);
  }
  const stdioSource = readTarballFile(tarballPath, "package/dist/stdio.js");
  const firstLine = stdioSource.split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine.startsWith("#!") || !/node/i.test(firstLine)) {
    throw new Error("Invalid stdio shebang.");
  }
}

async function main() {
  console.log("package-acceptance-postgres: building production package…");
  runPnpm(["--filter", "@osva-ai/connector-postgres", "build"], ROOT);

  const workRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-connector-postgres-acceptance-"),
  );
  const packDir = path.join(workRoot, "pack");
  const installDir = path.join(workRoot, "install");
  await fs.mkdir(packDir, { recursive: true });
  await fs.mkdir(installDir, { recursive: true });

  try {
    if (path.resolve(workRoot).startsWith(path.resolve(ROOT))) {
      throw new Error("Acceptance install dir must be outside the repository.");
    }

    console.log("package-acceptance-postgres: creating tarball…");
    runPnpm(["pack", "--pack-destination", packDir], PKG_DIR);

    const tarballName = (await fs.readdir(packDir)).find((f) =>
      f.endsWith(".tgz"),
    );
    if (tarballName === undefined) {
      throw new Error("No tarball produced.");
    }
    const tarballPath = path.join(packDir, tarballName);
    console.log(`package-acceptance-postgres: tarball ${tarballName}`);

    const manifest = await readPackedManifest(tarballPath);
    const entries = await listTarEntries(tarballPath);
    inspectTarballContents(entries, manifest);
    assertPackedBinMetadata(manifest, tarballPath);
    console.log(
      "package-acceptance-postgres: packed bin metadata and shebang verified",
    );

    console.log(
      "package-acceptance-postgres: npm publish --dry-run (bin normalization)…",
    );
    const dryRun = runNpmPublishDryRunForAcceptance(
      PKG_DIR,
      NPM_BIN_STRIP_PATTERN_POSTGRES,
    );
    if (dryRun === "version_already_published") {
      console.log(
        "package-acceptance-postgres: registry already has this version (acceptable)",
      );
    }
    console.log(
      `package-acceptance-postgres: ${entries.length} tarball entries verified`,
    );

    await fs.writeFile(
      path.join(installDir, "package.json"),
      `${JSON.stringify(
        {
          name: "osva-connector-postgres-acceptance",
          private: true,
          type: "module",
          description: "Isolated install acceptance (P0.5)",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    console.log(
      "package-acceptance-postgres: npm install tarball + MCP client…",
    );
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

    const integrationUrl = process.env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL;
    if (integrationUrl !== undefined && integrationUrl.trim().length > 0) {
      const smokeScript = path.join(
        installDir,
        "package-acceptance-postgres-smoke.mjs",
      );
      await fs.copyFile(
        path.join(ROOT, "scripts", "package-acceptance-postgres-smoke.mjs"),
        smokeScript,
      );
      console.log(
        "package-acceptance-postgres: running packaged MCP acceptance against PostgreSQL…",
      );
      runNode([smokeScript], installDir);
    } else {
      console.log(
        "package-acceptance-postgres: skipping MCP smoke (set OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL for full acceptance)",
      );
    }

    console.log("package-acceptance-postgres: all checks passed");
    console.log(`  tarball: ${tarballPath}`);
    console.log(`  install: ${installDir}`);
  } finally {
    if (process.env.OSVA_KEEP_ACCEPTANCE_DIR !== "1") {
      await fs.rm(workRoot, { recursive: true, force: true });
    } else {
      console.log(`package-acceptance-postgres: kept ${workRoot}`);
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
