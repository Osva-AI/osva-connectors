/**
 * B3 closeout: install @0.1.0 connectors from the public npm registry (not workspace pack),
 * verify tarball metadata, and run existing MCP smoke fixtures.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TARGET_VERSION = "0.1.0";
const EXPECTED_SDK = "1.1.4";
const REGISTRY = "https://registry.npmjs.org";

const B3_PACKAGES = [
  {
    name: "@osva-ai/connector-gmail",
    bin: "osva-connector-gmail",
    smoke: "package-acceptance-gmail-smoke.mjs",
  },
  {
    name: "@osva-ai/connector-google-calendar",
    bin: "osva-connector-google-calendar",
    smoke: "package-acceptance-google-calendar-smoke.mjs",
  },
  {
    name: "@osva-ai/connector-notion",
    bin: "osva-connector-notion",
    smoke: "package-acceptance-notion-smoke.mjs",
  },
  {
    name: "@osva-ai/connector-linear",
    bin: "osva-connector-linear",
    smoke: "package-acceptance-linear-smoke.mjs",
  },
  {
    name: "@osva-ai/connector-exa",
    bin: "osva-connector-exa",
    smoke: "package-acceptance-exa-smoke.mjs",
  },
  {
    name: "@osva-ai/connector-tavily",
    bin: "osva-connector-tavily",
    smoke: "package-acceptance-tavily-smoke.mjs",
  },
  {
    name: "@osva-ai/connector-firecrawl",
    bin: "osva-connector-firecrawl",
    smoke: "package-acceptance-firecrawl-smoke.mjs",
  },
];

const FORBIDDEN_INSTALL_PATHS = [/^test\//, /^\.env$/, /\/\.env$/];

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

function runNpm(args, cwd, env = process.env) {
  return run("npm", args, {
    cwd,
    shell: process.platform === "win32",
    env,
  });
}

function runNode(args, cwd) {
  return run(process.execPath, args, { cwd, shell: false });
}

function installedPackageDir(installDir, packageName) {
  const [scope, name] = packageName.split("/");
  return path.join(installDir, "node_modules", scope, name);
}

async function fetchRegistryManifest(packageName, version) {
  const spec = `${packageName}@${version}`;
  const result = spawnSync(
    "npm",
    ["view", spec, "--json", "--registry", REGISTRY],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    throw new Error(
      `npm view ${spec} failed: ${result.stderr ?? result.stdout}`,
    );
  }
  const raw = (result.stdout ?? "").trim();
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    const match = parsed.find((v) => v === version);
    if (!match) {
      throw new Error(`Registry version mismatch for ${spec}`);
    }
    return fetchRegistryManifest(packageName, version);
  }
  return parsed;
}

function parseProvenanceStatus(registryJson) {
  const attestations = registryJson?.dist?.attestations;
  const sigstore = registryJson?.dist?.signatures;
  if (Array.isArray(attestations) && attestations.length > 0) {
    return "attestations-present";
  }
  if (Array.isArray(sigstore) && sigstore.length > 0) {
    return "signatures-present";
  }
  return "no-provenance-metadata";
}

async function inspectInstalledTree(packageDir, manifest, binName) {
  const licensePath = path.join(packageDir, "LICENSE");
  await fs.access(licensePath);

  const stdioPath = path.join(packageDir, "dist", "stdio.js");
  await fs.access(stdioPath);

  const entries = await fs.readdir(packageDir, { recursive: true });
  for (const rel of entries) {
    const normalized = String(rel).replace(/\\/g, "/");
    for (const forbidden of FORBIDDEN_INSTALL_PATHS) {
      if (forbidden.test(normalized)) {
        throw new Error(`Forbidden installed path: ${normalized}`);
      }
    }
  }

  if (manifest.name === undefined || manifest.version !== TARGET_VERSION) {
    throw new Error(
      `Installed manifest mismatch: ${manifest.name}@${manifest.version}`,
    );
  }
  if (manifest.dependencies?.["@osva-ai/connector-sdk"] !== EXPECTED_SDK) {
    throw new Error(
      `SDK pin mismatch: ${manifest.dependencies?.["@osva-ai/connector-sdk"]}`,
    );
  }
  if (manifest.engines?.node !== ">=24") {
    throw new Error(`Unexpected engines.node: ${manifest.engines?.node}`);
  }
  const binPath = manifest.bin?.[binName];
  if (binPath !== "dist/stdio.js") {
    throw new Error(`Unexpected bin mapping: ${JSON.stringify(manifest.bin)}`);
  }
}

async function readLockIntegrity(installDir, packageName) {
  const lockPath = path.join(installDir, "package-lock.json");
  try {
    const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
    const node =
      lock.packages?.[`node_modules/${packageName}`] ??
      lock.dependencies?.[packageName];
    return node?.integrity ?? "no-lock-integrity";
  } catch {
    return "no-package-lock";
  }
}

async function acceptOne(workRoot, pkg, npmCache) {
  const env = {
    ...process.env,
    NPM_CONFIG_CACHE: npmCache,
    npm_config_cache: npmCache,
  };
  const installDir = path.join(
    workRoot,
    pkg.name.replace("@", "").replace("/", "-"),
  );
  await fs.mkdir(installDir, { recursive: true });

  console.log(`registry-b3: ${pkg.name}@${TARGET_VERSION} — registry view…`);
  const registryJson = await fetchRegistryManifest(pkg.name, TARGET_VERSION);
  const registryIntegrity = registryJson?.dist?.integrity ?? "missing";
  const provenance = parseProvenanceStatus(registryJson);

  await fs.writeFile(
    path.join(installDir, "package.json"),
    `${JSON.stringify(
      {
        name: "osva-b3-registry-acceptance",
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`registry-b3: ${pkg.name} — npm install from registry…`);
  runNpm(
    [
      "install",
      `${pkg.name}@${TARGET_VERSION}`,
      "@modelcontextprotocol/client@2.0.0",
      "--omit=dev",
      "--no-fund",
      "--no-audit",
      "--registry",
      REGISTRY,
    ],
    installDir,
    env,
  );

  const packageDir = installedPackageDir(installDir, pkg.name);
  const manifest = JSON.parse(
    await fs.readFile(path.join(packageDir, "package.json"), "utf8"),
  );
  await inspectInstalledTree(packageDir, manifest, pkg.bin);

  const binShim = path.join(
    installDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${pkg.bin}.cmd` : pkg.bin,
  );
  await fs.access(binShim);

  const lockIntegrity = await readLockIntegrity(installDir, pkg.name);

  const smokeDest = path.join(installDir, pkg.smoke);
  await fs.copyFile(path.join(ROOT, "scripts", pkg.smoke), smokeDest);

  console.log(`registry-b3: ${pkg.name} — MCP smoke…`);
  runNode([smokeDest], installDir);

  return {
    package: pkg.name,
    version: TARGET_VERSION,
    registryIntegrity,
    lockIntegrity,
    provenance,
    smoke: "passed",
  };
}

async function main() {
  const workRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-b3-registry-acceptance-"),
  );
  const npmCache = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-b3-npm-cache-"),
  );

  if (path.resolve(workRoot).startsWith(path.resolve(ROOT))) {
    throw new Error("Acceptance dir must be outside the repository.");
  }

  const results = [];
  try {
    for (const pkg of B3_PACKAGES) {
      results.push(await acceptOne(workRoot, pkg, npmCache));
    }
  } finally {
    if (process.env.OSVA_KEEP_ACCEPTANCE_DIR !== "1") {
      await fs.rm(workRoot, { recursive: true, force: true });
      await fs.rm(npmCache, { recursive: true, force: true });
    } else {
      console.log(`registry-b3: kept workRoot=${workRoot} cache=${npmCache}`);
    }
  }

  console.log("registry-b3: all packages passed");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
