/**
 * B5.4: Published-artifact acceptance — testable core (registry install + checks).
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  classifyNpmViewResult,
  NPM_VIEW_KIND,
} from "./classify-npm-view-result.mjs";
import { loadConnectorPackages } from "./load-connector-packages.mjs";

export const REGISTRY = "https://registry.npmjs.org";

export const CHECK = Object.freeze({
  REGISTRY_VERSION: "registry_version",
  REGISTRY_INTEGRITY: "registry_integrity",
  DEPENDENCY_RESOLUTION: "dependency_resolution",
  ARTIFACT_STDIO: "artifact_stdio",
  ARTIFACT_LICENSE: "artifact_license",
  FORBIDDEN_PATHS: "forbidden_paths",
  NPM_BIN: "npm_bin",
  LOCKFILE_INTEGRITY: "lockfile_integrity",
  SECRETS_SCAN: "secrets_scan",
  PROVENANCE: "provenance",
  DIST_TAG_LATEST: "dist_tag_latest",
  CLI_PROBE: "cli_probe",
  MCP_SMOKE: "mcp_smoke",
  MANIFEST_METADATA: "manifest_metadata",
  INSTALL_ISOLATION: "install_isolation",
});

export const STATUS = Object.freeze({
  PASSED: "PASSED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
});

/** B5.1 release wave — versions resolved from workspace manifests. */
export const B5_WAVE_DIRECTORIES = Object.freeze([
  "github",
  "aws-s3",
  "azure-blob",
  "bigquery",
  "gcs",
  "snowflake",
  "supabase",
  "qdrant",
  "intercom",
  "notion",
  "linear",
  "jira",
  "freshdesk",
  "firecrawl",
  "google-ads",
  "onedrive",
  "outlook",
  "pinecone",
]);

const FORBIDDEN_INSTALL_PATHS = [/^test\//, /^\.env$/, /\/\.env$/];

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /Bearer ey[a-zA-Z0-9._-]{20,}/,
];

const DEFAULT_INSTALL_TIMEOUT_MS = 120_000;
const DEFAULT_SMOKE_TIMEOUT_MS = 180_000;
const DEFAULT_NPM_PROBE_TIMEOUT_MS = 15_000;

export function slugFromDirectory(directory) {
  return directory === "github" ? "github" : directory;
}

export function binNameFromBinMap(binMap) {
  const keys = Object.keys(binMap ?? {});
  if (keys.length !== 1) {
    return undefined;
  }
  return keys[0];
}

export function smokeScriptFileForSlug(slug) {
  if (slug === "github") {
    return "package-acceptance-smoke.mjs";
  }
  return `package-acceptance-${slug}-smoke.mjs`;
}

export function smokeRequiresIntegrationEnv(slug) {
  return slug === "postgres";
}

export function integrationEnvReady(slug) {
  if (slug !== "postgres") {
    return true;
  }
  const url =
    process.env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL ??
    process.env.OSVA_CONNECTOR_POSTGRES_ACCEPTANCE_URL;
  return typeof url === "string" && url.trim().length > 0;
}

export function installedPackageDir(installDir, packageName) {
  const [scope, name] = packageName.split("/");
  return path.join(installDir, "node_modules", scope, name);
}

export function workDirSlug(packageName) {
  return packageName.replace("@", "").replace("/", "-");
}

export function detectStdoutProtocolPollution(stdout) {
  const text = String(stdout ?? "");
  if (text.trim().length === 0) {
    return null;
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        JSON.parse(trimmed);
        continue;
      } catch {
        return `non-JSON line on stdout: ${line.slice(0, 120)}`;
      }
    }
    return `protocol pollution on stdout: ${line.slice(0, 120)}`;
  }
  return null;
}

export function compareLockIntegrity(lockIntegrity, registryIntegrity) {
  if (!registryIntegrity || registryIntegrity === "missing") {
    return { ok: false, reason: "registry integrity missing" };
  }
  if (!lockIntegrity || lockIntegrity === "no-package-lock") {
    return { ok: false, reason: "package-lock.json missing" };
  }
  if (lockIntegrity === "no-lock-integrity") {
    return { ok: false, reason: "lockfile missing integrity for package" };
  }
  if (lockIntegrity !== registryIntegrity) {
    return {
      ok: false,
      reason: `integrity mismatch lock=${lockIntegrity} registry=${registryIntegrity}`,
    };
  }
  return { ok: true, reason: lockIntegrity };
}

export function parseProvenanceStatus(
  registryJson,
  { requireProvenance = false } = {},
) {
  const attestations = registryJson?.dist?.attestations;
  const sigstore = registryJson?.dist?.signatures;
  if (Array.isArray(attestations) && attestations.length > 0) {
    return { status: STATUS.PASSED, detail: "attestations-present" };
  }
  if (Array.isArray(sigstore) && sigstore.length > 0) {
    return { status: STATUS.PASSED, detail: "signatures-present" };
  }
  if (requireProvenance) {
    return {
      status: STATUS.FAILED,
      detail: "OIDC publish requires registry provenance metadata",
    };
  }
  return {
    status: STATUS.SKIPPED,
    detail: "no-provenance-metadata-on-registry",
  };
}

export function evaluateDistTagLatest(
  latestTag,
  expectedVersion,
  assertLatest,
) {
  if (!assertLatest) {
    return {
      status: STATUS.SKIPPED,
      evidence: "dist-tag check not requested (--expect-latest)",
    };
  }
  if (latestTag === undefined || latestTag === "") {
    return { status: STATUS.FAILED, evidence: "npm dist-tag latest missing" };
  }
  if (latestTag === expectedVersion) {
    return { status: STATUS.PASSED, evidence: `latest=${latestTag}` };
  }
  return {
    status: STATUS.FAILED,
    evidence: `latest=${latestTag} expected=${expectedVersion}`,
  };
}

export async function readLockIntegrity(installDir, packageName) {
  const lockPath = path.join(installDir, "package-lock.json");
  try {
    const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
    const directKey = `node_modules/${packageName}`;
    const direct =
      lock.packages?.[directKey] ?? lock.dependencies?.[packageName];
    if (direct?.integrity) {
      return direct.integrity;
    }
    if (lock.packages && typeof lock.packages === "object") {
      for (const [key, value] of Object.entries(lock.packages)) {
        if (
          (key === directKey || key.endsWith(`/${packageName}`)) &&
          value?.integrity
        ) {
          return value.integrity;
        }
      }
    }
    return "no-lock-integrity";
  } catch {
    return "no-package-lock";
  }
}

export async function scanTreeForSecrets(packageDir) {
  const hits = [];
  async function walk(dir, relBase = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") {
          continue;
        }
        await walk(full, rel);
        continue;
      }
      if (entry.name.endsWith(".map") || entry.name.endsWith(".png")) {
        continue;
      }
      let raw;
      try {
        const buf = await fs.readFile(full);
        if (buf.length > 512_000) {
          continue;
        }
        raw = buf.toString("utf8");
      } catch {
        continue;
      }
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(raw)) {
          hits.push(`${rel} matches ${pattern}`);
        }
      }
    }
  }
  await walk(packageDir);
  return hits;
}

export async function inspectInstalledArtifacts({
  packageDir,
  manifest,
  binName,
  expectedVersion,
  expectedSdkVersion,
}) {
  const errors = [];

  const licenseCandidates = ["LICENSE", "LICENSE.md", "License", "license"];
  let licenseFound = false;
  for (const name of licenseCandidates) {
    try {
      await fs.access(path.join(packageDir, name));
      licenseFound = true;
      break;
    } catch {
      // try next candidate
    }
  }
  if (!licenseFound && !manifest.license) {
    errors.push("LICENSE missing");
  }

  try {
    await fs.access(path.join(packageDir, "dist", "stdio.js"));
  } catch {
    errors.push("dist/stdio.js missing");
  }

  if (manifest.version !== expectedVersion) {
    errors.push(
      `installed version ${manifest.version} !== expected ${expectedVersion}`,
    );
  }
  if (manifest.engines?.node !== ">=24") {
    errors.push(`unexpected engines.node: ${manifest.engines?.node}`);
  }
  const binPath = manifest.bin?.[binName];
  if (binPath !== "dist/stdio.js") {
    errors.push(`unexpected bin mapping: ${JSON.stringify(manifest.bin)}`);
  }
  if (
    expectedSdkVersion &&
    manifest.dependencies?.["@osva-ai/connector-sdk"] !== expectedSdkVersion
  ) {
    errors.push(
      `SDK pin mismatch: ${manifest.dependencies?.["@osva-ai/connector-sdk"]}`,
    );
  }

  const entries = await fs.readdir(packageDir, { recursive: true });
  for (const rel of entries) {
    const normalized = String(rel).replace(/\\/g, "/");
    for (const forbidden of FORBIDDEN_INSTALL_PATHS) {
      if (forbidden.test(normalized)) {
        errors.push(`forbidden path: ${normalized}`);
      }
    }
  }

  return errors;
}

export function runSync(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

export function defaultRunNpm(args, cwd, env = process.env, options = {}) {
  return runSync("npm", args, {
    cwd,
    shell: process.platform === "win32",
    env,
    timeout: options.timeoutMs,
    killSignal: "SIGTERM",
  });
}

export function npmViewPackage(spec, runNpm = defaultRunNpm) {
  return runNpm(
    ["view", spec, "--json", "--registry", REGISTRY],
    process.cwd(),
  );
}

export function classifyRegistryView(result, expectedVersion) {
  return classifyNpmViewResult({
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    expectedVersion,
  });
}

export function parseRegistryViewJson(stdout) {
  const trimmed = String(stdout ?? "").trim();
  if (!trimmed) {
    return {};
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return {};
  }
}

export function npmDistTagLatest(packageName, runNpm = defaultRunNpm) {
  const result = runNpm(
    ["dist-tag", "ls", packageName, "--json", "--registry", REGISTRY],
    process.cwd(),
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr ?? result.stdout };
  }
  try {
    const parsed = JSON.parse(result.stdout ?? "{}");
    return { ok: true, latest: parsed.latest };
  } catch {
    const text = String(result.stdout ?? "");
    const match = text.match(/^\s*latest:\s*(\S+)/m);
    if (match?.[1]) {
      return { ok: true, latest: match[1] };
    }
    return { ok: false, error: "invalid dist-tag json" };
  }
}

export function spawnWithWallClockDeadline(command, args, options, deadlineMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, deadlineMs);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        resolve({
          timedOut: true,
          code,
          signal,
          stdout,
          stderr,
        });
        return;
      }
      resolve({ timedOut: false, code, signal, stdout, stderr });
    });
  });
}

export function makeCheckResult(id, status, evidence = "") {
  return { id, status, evidence };
}

export function isOptionalSkippedCheck(check, target) {
  if (check.status !== STATUS.SKIPPED) {
    return false;
  }
  if (check.id === CHECK.CLI_PROBE) {
    return true;
  }
  if (
    check.id === CHECK.MCP_SMOKE &&
    String(check.evidence ?? "").includes("postgres integration")
  ) {
    return true;
  }
  if (check.id === CHECK.PROVENANCE && !target?.wave) {
    return true;
  }
  if (
    check.id === CHECK.DIST_TAG_LATEST &&
    String(check.evidence ?? "").includes("not requested")
  ) {
    return true;
  }
  return false;
}

export function summarizePackageChecks(checks, target) {
  const failed = checks.filter((c) => c.status === STATUS.FAILED);
  const passed = checks.filter((c) => c.status === STATUS.PASSED);
  const skipped = checks.filter((c) => c.status === STATUS.SKIPPED);
  const requiredSkips = skipped.filter(
    (c) => !isOptionalSkippedCheck(c, target),
  );
  let overall = STATUS.PASSED;
  if (failed.length > 0 || requiredSkips.length > 0) {
    overall = STATUS.FAILED;
  } else if (passed.length === 0 && skipped.length === checks.length) {
    overall = STATUS.SKIPPED;
  }
  return {
    overall,
    passed: passed.length,
    failed: failed.length,
    skipped: skipped.length,
    requiredSkips: requiredSkips.length,
  };
}

export async function assertInstalledOutsideMonorepo(packageDir, repoRoot) {
  const resolved = path.resolve(await fs.realpath(packageDir));
  const repo = path.resolve(repoRoot);
  if (resolved === repo || resolved.startsWith(`${repo}${path.sep}`)) {
    throw new Error(`installed package resolves inside monorepo: ${resolved}`);
  }
}

export function renderMarkdownReport(report) {
  const lines = [
    "# Published package acceptance report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Platform: ${report.platform}`,
    `- Node: ${report.nodeVersion}`,
    `- npm cache: ${report.npmCache ?? "n/a"}`,
    `- Concurrency: ${report.concurrency}`,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Packages failed | ${report.summary.packagesFailed} |`,
    `| Packages passed | ${report.summary.packagesPassed} |`,
    `| Packages skipped | ${report.summary.packagesSkipped} |`,
    `| Individual checks skipped | ${report.summary.checksSkipped} |`,
    "",
    "## Packages",
    "",
  ];
  for (const pkg of report.packages) {
    lines.push(`### ${pkg.name}@${pkg.version} — **${pkg.overall}**`);
    lines.push("");
    lines.push("| Check | Status | Evidence |");
    lines.push("| --- | --- | --- |");
    for (const check of pkg.checks) {
      const evidence = String(check.evidence ?? "").replace(/\|/g, "\\|");
      lines.push(`| ${check.id} | ${check.status} | ${evidence} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function loadExpectedSdkVersion(repoRoot) {
  const githubManifest = JSON.parse(
    await fs.readFile(
      path.join(repoRoot, "packages", "github", "package.json"),
      "utf8",
    ),
  );
  return githubManifest.dependencies?.["@osva-ai/connector-sdk"];
}

export async function buildConnectorTargets(
  repoRoot,
  { waveOnly = false } = {},
) {
  const connectors = await loadConnectorPackages(repoRoot);
  const waveSet = new Set(B5_WAVE_DIRECTORIES);
  const wave = [];
  const rest = [];
  for (const connector of connectors) {
    const slug = slugFromDirectory(connector.directory);
    const binName = binNameFromBinMap(connector.bin);
    if (!binName) {
      continue;
    }
    const target = {
      directory: connector.directory,
      slug,
      name: connector.name,
      version: connector.version,
      binName,
      wave: waveSet.has(connector.directory),
    };
    if (target.wave) {
      wave.push(target);
    } else {
      rest.push(target);
    }
  }
  wave.sort(
    (a, b) =>
      B5_WAVE_DIRECTORIES.indexOf(a.directory) -
      B5_WAVE_DIRECTORIES.indexOf(b.directory),
  );
  rest.sort((a, b) => a.directory.localeCompare(b.directory));
  if (waveOnly) {
    return wave;
  }
  return [...wave, ...rest];
}

export async function runSmokeScript({
  installDir,
  scriptsRoot,
  slug,
  timeoutMs,
  spawnImpl = spawnWithWallClockDeadline,
}) {
  const smokeFile = smokeScriptFileForSlug(slug);
  const source = path.join(scriptsRoot, smokeFile);
  try {
    await fs.access(source);
  } catch {
    return {
      status: STATUS.SKIPPED,
      evidence: `no smoke script ${smokeFile}`,
    };
  }
  if (!integrationEnvReady(slug)) {
    return {
      status: STATUS.SKIPPED,
      evidence:
        "postgres integration URL not set (OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL)",
    };
  }
  const dest = path.join(installDir, smokeFile);
  await fs.copyFile(source, dest);
  const result = await spawnImpl(
    process.execPath,
    [dest],
    { cwd: installDir, shell: false, env: process.env },
    timeoutMs,
  );
  if (result.timedOut) {
    return {
      status: STATUS.FAILED,
      evidence: `smoke timed out after ${timeoutMs}ms`,
    };
  }
  if (result.code !== 0) {
    return {
      status: STATUS.FAILED,
      evidence: `smoke exit ${result.code}: ${(result.stderr ?? "").slice(0, 400)}`,
    };
  }
  return { status: STATUS.PASSED, evidence: "smoke script exit 0" };
}

async function probeCliMissingCredentials({
  installDir,
  binName,
  timeoutMs,
  spawnImpl = spawnWithWallClockDeadline,
}) {
  const binDir = path.join(installDir, "node_modules", ".bin");
  const command =
    process.platform === "win32"
      ? path.join(binDir, `${binName}.cmd`)
      : path.join(binDir, binName);
  try {
    await fs.access(command);
  } catch {
    return { status: STATUS.SKIPPED, evidence: "bin shim missing for probe" };
  }
  const shell = process.platform === "win32";
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("OSVA_CONNECTOR_") && key.endsWith("_TOKEN")) {
      delete env[key];
    }
  }
  const result = await spawnImpl(
    command,
    [],
    { cwd: installDir, shell, env },
    timeoutMs,
  );
  if (result.timedOut) {
    return {
      status: STATUS.FAILED,
      evidence: `CLI probe timed out after ${timeoutMs}ms`,
    };
  }
  const pollution = detectStdoutProtocolPollution(result.stdout);
  if (pollution) {
    return { status: STATUS.FAILED, evidence: pollution };
  }
  if (result.code === 0) {
    return {
      status: STATUS.SKIPPED,
      evidence: "CLI exited 0 without credentials (no fail-fast probe)",
    };
  }
  return {
    status: STATUS.PASSED,
    evidence: `CLI fail-fast exit ${result.code}, stdout clean`,
  };
}

export async function acceptPublishedPackage(target, options) {
  const {
    repoRoot,
    workRoot,
    npmCache,
    scriptsRoot,
    expectedSdkVersion,
    expectLatest = false,
    installTimeoutMs = DEFAULT_INSTALL_TIMEOUT_MS,
    smokeTimeoutMs = DEFAULT_SMOKE_TIMEOUT_MS,
    npmProbeTimeoutMs = DEFAULT_NPM_PROBE_TIMEOUT_MS,
    runNpm = defaultRunNpm,
    spawnImpl = spawnWithWallClockDeadline,
    skipInstall = false,
    registryFixture,
  } = options;

  const checks = [];
  const env = {
    ...process.env,
    NPM_CONFIG_CACHE: npmCache,
    npm_config_cache: npmCache,
  };

  const spec = `${target.name}@${target.version}`;
  let registryJson = registryFixture;
  let registryIntegrity = registryFixture?.dist?.integrity;
  let viewKind = registryFixture ? NPM_VIEW_KIND.published : null;

  if (!registryFixture) {
    const viewResult = npmViewPackage(spec, runNpm);
    if (viewResult.status === 0) {
      registryJson = parseRegistryViewJson(viewResult.stdout);
      if (registryJson?.version === target.version) {
        viewKind = NPM_VIEW_KIND.published;
        registryIntegrity = registryJson?.dist?.integrity;
      } else {
        viewKind = NPM_VIEW_KIND.unknown;
      }
    } else {
      viewKind = classifyRegistryView(viewResult, target.version).kind;
    }
    const versionMessage =
      viewKind === NPM_VIEW_KIND.published
        ? `registry has ${target.version}`
        : viewResult.status === 0
          ? `npm view JSON version ${registryJson?.version ?? "?"} !== ${target.version}`
          : classifyRegistryView(viewResult, target.version).message;
    checks.push(
      makeCheckResult(
        CHECK.REGISTRY_VERSION,
        viewKind === NPM_VIEW_KIND.published ? STATUS.PASSED : STATUS.FAILED,
        versionMessage,
      ),
    );
    checks.push(
      makeCheckResult(
        CHECK.REGISTRY_INTEGRITY,
        registryIntegrity ? STATUS.PASSED : STATUS.FAILED,
        registryIntegrity ?? "missing dist.integrity",
      ),
    );
  } else {
    checks.push(
      makeCheckResult(CHECK.REGISTRY_VERSION, STATUS.PASSED, "fixture"),
    );
    checks.push(
      makeCheckResult(
        CHECK.REGISTRY_INTEGRITY,
        registryIntegrity ? STATUS.PASSED : STATUS.FAILED,
        registryIntegrity ?? "missing",
      ),
    );
  }

  const installDir = path.join(workRoot, workDirSlug(target.name));
  await fs.mkdir(installDir, { recursive: true });

  const canInstall =
    viewKind === NPM_VIEW_KIND.published || Boolean(registryFixture);

  if (canInstall && !skipInstall) {
    await fs.writeFile(
      path.join(installDir, "package.json"),
      `${JSON.stringify(
        {
          name: "osva-published-acceptance",
          private: true,
          type: "module",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const installResult = await Promise.resolve(
      runNpm(
        [
          "install",
          spec,
          "@modelcontextprotocol/client@2.0.0",
          "--save-exact",
          "--omit=dev",
          "--no-fund",
          "--no-audit",
          "--registry",
          REGISTRY,
        ],
        installDir,
        env,
        { timeoutMs: installTimeoutMs },
      ),
    );
    const installOk = installResult?.status === 0;
    const installEvidence = installOk
      ? "npm install completed"
      : installResult?.signal === "SIGTERM"
        ? `npm install timed out after ${installTimeoutMs}ms`
        : `${(installResult.stderr ?? installResult.stdout ?? "").slice(0, 500)}`;
    checks.push(
      makeCheckResult(
        CHECK.DEPENDENCY_RESOLUTION,
        installOk ? STATUS.PASSED : STATUS.FAILED,
        installEvidence,
      ),
    );

    if (installOk) {
      const packageDir = installedPackageDir(installDir, target.name);
      try {
        await assertInstalledOutsideMonorepo(packageDir, repoRoot);
        checks.push(
          makeCheckResult(
            CHECK.INSTALL_ISOLATION,
            STATUS.PASSED,
            "node_modules outside monorepo",
          ),
        );
      } catch (error) {
        checks.push(
          makeCheckResult(
            CHECK.INSTALL_ISOLATION,
            STATUS.FAILED,
            error instanceof Error ? error.message : String(error),
          ),
        );
        for (const id of [
          CHECK.ARTIFACT_LICENSE,
          CHECK.ARTIFACT_STDIO,
          CHECK.FORBIDDEN_PATHS,
          CHECK.MANIFEST_METADATA,
          CHECK.NPM_BIN,
          CHECK.LOCKFILE_INTEGRITY,
          CHECK.SECRETS_SCAN,
          CHECK.PROVENANCE,
          CHECK.DIST_TAG_LATEST,
          CHECK.CLI_PROBE,
          CHECK.MCP_SMOKE,
        ]) {
          checks.push(
            makeCheckResult(id, STATUS.SKIPPED, "install layout invalid"),
          );
        }
        return {
          name: target.name,
          version: target.version,
          directory: target.directory,
          wave: target.wave,
          installDir,
          ...summarizePackageChecks(checks, target),
          checks,
        };
      }
      const manifest = JSON.parse(
        await fs.readFile(path.join(packageDir, "package.json"), "utf8"),
      );
      const artifactErrors = await inspectInstalledArtifacts({
        packageDir,
        manifest,
        binName: target.binName,
        expectedVersion: target.version,
        expectedSdkVersion,
      });
      checks.push(
        makeCheckResult(
          CHECK.ARTIFACT_LICENSE,
          artifactErrors.some((e) => e.includes("LICENSE"))
            ? STATUS.FAILED
            : STATUS.PASSED,
          artifactErrors.find((e) => e.includes("LICENSE")) ??
            "LICENSE present",
        ),
      );
      checks.push(
        makeCheckResult(
          CHECK.ARTIFACT_STDIO,
          artifactErrors.some((e) => e.includes("stdio"))
            ? STATUS.FAILED
            : STATUS.PASSED,
          artifactErrors.find((e) => e.includes("stdio")) ??
            "dist/stdio.js present",
        ),
      );
      checks.push(
        makeCheckResult(
          CHECK.FORBIDDEN_PATHS,
          artifactErrors.some((e) => e.startsWith("forbidden"))
            ? STATUS.FAILED
            : STATUS.PASSED,
          artifactErrors.filter((e) => e.startsWith("forbidden")).join("; ") ||
            "no forbidden paths",
        ),
      );
      const manifestErrors = artifactErrors.filter(
        (e) =>
          !e.includes("LICENSE") &&
          !e.includes("stdio") &&
          !e.startsWith("forbidden"),
      );
      if (manifestErrors.length > 0) {
        checks.push(
          makeCheckResult(
            CHECK.MANIFEST_METADATA,
            STATUS.FAILED,
            manifestErrors.join("; "),
          ),
        );
      } else {
        checks.push(
          makeCheckResult(
            CHECK.MANIFEST_METADATA,
            STATUS.PASSED,
            "engines, bin, sdk pin",
          ),
        );
      }

      const binShim = path.join(
        installDir,
        "node_modules",
        ".bin",
        process.platform === "win32" ? `${target.binName}.cmd` : target.binName,
      );
      try {
        await fs.access(binShim);
        checks.push(makeCheckResult(CHECK.NPM_BIN, STATUS.PASSED, binShim));
      } catch {
        checks.push(
          makeCheckResult(CHECK.NPM_BIN, STATUS.FAILED, "bin shim missing"),
        );
      }

      const lockIntegrity = await readLockIntegrity(installDir, target.name);
      const integrityCmp = compareLockIntegrity(
        lockIntegrity,
        registryIntegrity ?? "missing",
      );
      checks.push(
        makeCheckResult(
          CHECK.LOCKFILE_INTEGRITY,
          integrityCmp.ok ? STATUS.PASSED : STATUS.FAILED,
          integrityCmp.reason,
        ),
      );

      const secretHits = await scanTreeForSecrets(packageDir);
      checks.push(
        makeCheckResult(
          CHECK.SECRETS_SCAN,
          secretHits.length === 0 ? STATUS.PASSED : STATUS.FAILED,
          secretHits.join("; ") || "no secret patterns",
        ),
      );

      const prov = parseProvenanceStatus(registryJson ?? {}, {
        requireProvenance: target.wave,
      });
      checks.push(makeCheckResult(CHECK.PROVENANCE, prov.status, prov.detail));

      const tagResult = npmDistTagLatest(target.name, runNpm);
      if (!tagResult.ok) {
        checks.push(
          makeCheckResult(
            CHECK.DIST_TAG_LATEST,
            STATUS.SKIPPED,
            `dist-tag lookup failed: ${String(tagResult.error).slice(0, 200)}`,
          ),
        );
      } else {
        const tagEval = evaluateDistTagLatest(
          tagResult.latest,
          target.version,
          expectLatest || target.wave,
        );
        checks.push(
          makeCheckResult(
            CHECK.DIST_TAG_LATEST,
            tagEval.status,
            tagEval.evidence,
          ),
        );
      }

      const cliProbe = await probeCliMissingCredentials({
        installDir,
        binName: target.binName,
        timeoutMs: npmProbeTimeoutMs,
        spawnImpl,
      });
      checks.push(
        makeCheckResult(CHECK.CLI_PROBE, cliProbe.status, cliProbe.evidence),
      );

      const smoke = await runSmokeScript({
        installDir,
        scriptsRoot,
        slug: target.slug,
        timeoutMs: smokeTimeoutMs,
        spawnImpl,
      });
      checks.push(
        makeCheckResult(CHECK.MCP_SMOKE, smoke.status, smoke.evidence),
      );
    } else {
      for (const id of [
        CHECK.INSTALL_ISOLATION,
        CHECK.ARTIFACT_LICENSE,
        CHECK.ARTIFACT_STDIO,
        CHECK.FORBIDDEN_PATHS,
        CHECK.MANIFEST_METADATA,
        CHECK.NPM_BIN,
        CHECK.LOCKFILE_INTEGRITY,
        CHECK.SECRETS_SCAN,
        CHECK.PROVENANCE,
        CHECK.DIST_TAG_LATEST,
        CHECK.CLI_PROBE,
        CHECK.MCP_SMOKE,
      ]) {
        checks.push(
          makeCheckResult(id, STATUS.SKIPPED, "install did not succeed"),
        );
      }
    }
  } else {
    for (const id of [
      CHECK.DEPENDENCY_RESOLUTION,
      CHECK.INSTALL_ISOLATION,
      CHECK.ARTIFACT_LICENSE,
      CHECK.ARTIFACT_STDIO,
      CHECK.FORBIDDEN_PATHS,
      CHECK.MANIFEST_METADATA,
      CHECK.NPM_BIN,
      CHECK.LOCKFILE_INTEGRITY,
      CHECK.SECRETS_SCAN,
      CHECK.PROVENANCE,
      CHECK.DIST_TAG_LATEST,
      CHECK.CLI_PROBE,
      CHECK.MCP_SMOKE,
    ]) {
      checks.push(
        makeCheckResult(
          id,
          STATUS.SKIPPED,
          skipInstall ? "skipInstall" : "version not on registry",
        ),
      );
    }
  }

  return {
    name: target.name,
    version: target.version,
    directory: target.directory,
    wave: target.wave,
    installDir: canInstall && !skipInstall ? installDir : undefined,
    ...summarizePackageChecks(checks, target),
    checks,
  };
}

export async function runPublishedAcceptanceMatrix({
  repoRoot,
  targets,
  concurrency = 1,
  expectLatest = false,
  keepWorkDir = false,
  reportPaths = {},
  deps = {},
}) {
  const scriptsRoot = path.join(repoRoot, "scripts");
  const parentTmp = path.resolve(os.tmpdir());
  const repoResolved = path.resolve(repoRoot);
  if (
    parentTmp === repoResolved ||
    repoResolved.startsWith(`${parentTmp}${path.sep}`)
  ) {
    // still ok — work root is sibling under os.tmpdir(), verified per package below
  }

  const workRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-published-acceptance-"),
  );
  const npmCache = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-published-npm-cache-"),
  );
  if (path.resolve(workRoot).startsWith(repoResolved)) {
    throw new Error("Acceptance work root must be outside the monorepo.");
  }

  const expectedSdkVersion = await loadExpectedSdkVersion(repoRoot);
  const runNpm = deps.runNpm ?? defaultRunNpm;
  const spawnImpl = deps.spawnImpl ?? spawnWithWallClockDeadline;
  const acceptOne = deps.acceptOne ?? acceptPublishedPackage;

  const packages = new Array(targets.length);
  let nextTarget = 0;

  async function worker() {
    while (true) {
      const index = nextTarget;
      nextTarget += 1;
      if (index >= targets.length) {
        return;
      }
      const target = targets[index];
      packages[index] = await acceptOne(target, {
        repoRoot,
        workRoot,
        npmCache,
        scriptsRoot,
        expectedSdkVersion,
        expectLatest,
        runNpm,
        spawnImpl,
        ...deps.options,
      });
    }
  }

  const poolSize = Math.max(1, Math.min(concurrency, targets.length || 1));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  const summary = {
    packagesPassed: packages.filter((p) => p.overall === STATUS.PASSED).length,
    packagesFailed: packages.filter((p) => p.overall === STATUS.FAILED).length,
    packagesSkipped: packages.filter((p) => p.overall === STATUS.SKIPPED)
      .length,
    checksSkipped: packages.reduce(
      (acc, p) =>
        acc + p.checks.filter((c) => c.status === STATUS.SKIPPED).length,
      0,
    ),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    npmCache,
    workRoot: keepWorkDir ? workRoot : "[removed]",
    concurrency: poolSize,
    summary,
    packages,
  };

  if (reportPaths.json) {
    await fs.mkdir(path.dirname(reportPaths.json), { recursive: true });
    await fs.writeFile(
      reportPaths.json,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
  }
  if (reportPaths.markdown) {
    await fs.mkdir(path.dirname(reportPaths.markdown), { recursive: true });
    await fs.writeFile(
      reportPaths.markdown,
      renderMarkdownReport(report),
      "utf8",
    );
  }

  if (!keepWorkDir && process.env.OSVA_KEEP_ACCEPTANCE_DIR !== "1") {
    await fs.rm(workRoot, { recursive: true, force: true });
    await fs.rm(npmCache, { recursive: true, force: true });
  }

  return report;
}
