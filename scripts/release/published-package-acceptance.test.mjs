import assert from "node:assert/strict";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

function fsSyncTreeForInstall(
  cwd,
  scopedPackageDir,
  binName,
  version,
  integrity,
) {
  const packageName = `@osva-ai/${scopedPackageDir}`;
  const pkgRoot = path.join(cwd, "node_modules", "@osva-ai", scopedPackageDir);
  fsSync.mkdirSync(path.join(pkgRoot, "dist"), { recursive: true });
  fsSync.writeFileSync(path.join(pkgRoot, "LICENSE"), "MIT", "utf8");
  fsSync.writeFileSync(
    path.join(pkgRoot, "dist", "stdio.js"),
    "#!/usr/bin/env node\n",
    "utf8",
  );
  fsSync.writeFileSync(
    path.join(pkgRoot, "package.json"),
    JSON.stringify({
      name: packageName,
      version,
      engines: { node: ">=24" },
      bin: { [binName]: "dist/stdio.js" },
      dependencies: { "@osva-ai/connector-sdk": "1.1.4" },
    }),
    "utf8",
  );
  fsSync.mkdirSync(path.join(cwd, "node_modules", ".bin"), { recursive: true });
  const bin =
    process.platform === "win32"
      ? path.join(cwd, "node_modules", ".bin", `${binName}.cmd`)
      : path.join(cwd, "node_modules", ".bin", binName);
  fsSync.writeFileSync(
    bin,
    process.platform === "win32"
      ? "@echo off\r\nexit /b 1\r\n"
      : "#!/bin/sh\nexit 1\n",
    "utf8",
  );
  fsSync.writeFileSync(
    path.join(cwd, "package-lock.json"),
    JSON.stringify({
      packages: {
        [`node_modules/${packageName}`]: {
          integrity,
        },
      },
    }),
    "utf8",
  );
  fsSync.writeFileSync(path.join(cwd, ".fixture-install"), "1", "utf8");
}

import {
  acceptPublishedPackage,
  B5_WAVE_DIRECTORIES,
  CHECK,
  compareLockIntegrity,
  detectStdoutProtocolPollution,
  evaluateDistTagLatest,
  inspectInstalledArtifacts,
  parseProvenanceStatus,
  renderMarkdownReport,
  runPublishedAcceptanceMatrix,
  runSmokeScript,
  STATUS,
  summarizePackageChecks,
} from "./published-package-acceptance-core.mjs";
import { buildConnectorTargets } from "./published-package-acceptance.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);

test("compareLockIntegrity fails on mismatch and passes on match", () => {
  const ok = compareLockIntegrity("sha512-abc", "sha512-abc");
  assert.equal(ok.ok, true);
  const bad = compareLockIntegrity("sha512-a", "sha512-b");
  assert.equal(bad.ok, false);
});

test("detectStdoutProtocolPollution flags non-JSON lines", () => {
  assert.equal(detectStdoutProtocolPollution(""), null);
  assert.equal(detectStdoutProtocolPollution('{"jsonrpc":"2.0"}'), null);
  assert.match(
    detectStdoutProtocolPollution("npm warn something\n"),
    /pollution/,
  );
});

test("missing registry version skips install checks", async () => {
  const workRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-pub-acc-test-"),
  );
  const npmCache = await fs.mkdtemp(path.join(os.tmpdir(), "osva-pub-npm-"));
  try {
    const result = await acceptPublishedPackage(
      {
        directory: "gmail",
        slug: "gmail",
        name: "@osva-ai/connector-gmail",
        version: "0.0.0-missing",
        binName: "osva-connector-gmail",
        wave: false,
      },
      {
        repoRoot: ROOT,
        workRoot,
        npmCache,
        scriptsRoot: path.join(ROOT, "scripts"),
        expectedSdkVersion: "1.1.4",
        runNpm: (args) => ({
          status: 1,
          stdout: "",
          stderr: "npm error code E404\nnpm error 404 Not Found",
        }),
      },
    );
    assert.equal(result.overall, STATUS.FAILED);
    const versionCheck = result.checks.find(
      (c) => c.id === CHECK.REGISTRY_VERSION,
    );
    assert.equal(versionCheck.status, STATUS.FAILED);
    const installCheck = result.checks.find(
      (c) => c.id === CHECK.DEPENDENCY_RESOLUTION,
    );
    assert.equal(installCheck.status, STATUS.SKIPPED);
    assert.match(installCheck.evidence, /not on registry/);
  } finally {
    await fs.rm(workRoot, { recursive: true, force: true, maxRetries: 5 });
    await fs.rm(npmCache, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("malformed installed artifact fails layout checks", async () => {
  const workRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-pub-acc-artifact-"),
  );
  const packageDir = path.join(workRoot, "pkg");
  await fs.mkdir(path.join(packageDir, "dist"), { recursive: true });
  await fs.mkdir(path.join(packageDir, "test"), { recursive: true });
  await fs.writeFile(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "@osva-ai/connector-gmail",
      version: "0.1.0",
      engines: { node: ">=24" },
      bin: { "osva-connector-gmail": "dist/stdio.js" },
      dependencies: { "@osva-ai/connector-sdk": "1.1.4" },
    }),
    "utf8",
  );
  await fs.writeFile(path.join(packageDir, "LICENSE"), "MIT", "utf8");
  await fs.writeFile(path.join(packageDir, "test", "secret.txt"), "x", "utf8");
  const errors = await inspectInstalledArtifacts({
    packageDir,
    manifest: JSON.parse(
      await fs.readFile(path.join(packageDir, "package.json"), "utf8"),
    ),
    binName: "osva-connector-gmail",
    expectedVersion: "0.1.0",
    expectedSdkVersion: "1.1.4",
  });
  assert.ok(errors.some((e) => e.startsWith("forbidden")));
});

test("invalid integrity fails lockfile check", () => {
  const cmp = compareLockIntegrity("sha512-wrong", "sha512-expected");
  assert.equal(cmp.ok, false);
  assert.match(cmp.reason, /mismatch/);
});

test("acceptPublishedPackage success path with fixture and mocked install tree", async () => {
  const workRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-pub-acc-success-"),
  );
  const npmCache = await fs.mkdtemp(path.join(os.tmpdir(), "osva-pub-npm-ok-"));

  function fakeRunNpm(args, cwd) {
    if (args[0] === "install") {
      const pkgRoot = path.join(
        cwd,
        "node_modules",
        "@osva-ai",
        "connector-gmail",
      );
      fsSyncTreeForInstall(
        cwd,
        "connector-gmail",
        "osva-connector-gmail",
        "0.1.0",
        "sha512-good",
      );
      return { status: 0, stdout: "", stderr: "" };
    }
    if (args[0] === "dist-tag") {
      return { status: 0, stdout: '{"latest":"0.1.0"}', stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  }

  const spawnImpl = async (_cmd, args) => {
    if (String(args[0] ?? "").includes("smoke.mjs")) {
      return { timedOut: false, code: 0, stdout: "", stderr: "" };
    }
    return {
      timedOut: false,
      code: 1,
      stdout: "",
      stderr: "missing token",
    };
  };

  try {
    const result = await acceptPublishedPackage(
      {
        directory: "gmail",
        slug: "gmail",
        name: "@osva-ai/connector-gmail",
        version: "0.1.0",
        binName: "osva-connector-gmail",
        wave: false,
      },
      {
        repoRoot: ROOT,
        workRoot,
        npmCache,
        scriptsRoot: path.join(ROOT, "scripts"),
        expectedSdkVersion: "1.1.4",
        registryFixture: {
          version: "0.1.0",
          dist: { integrity: "sha512-good" },
        },
        runNpm: fakeRunNpm,
        spawnImpl,
        smokeTimeoutMs: 5_000,
        npmProbeTimeoutMs: 5_000,
      },
    );

    const failedChecks = result.checks.filter(
      (c) => c.status === STATUS.FAILED,
    );
    assert.equal(failedChecks.length, 0, JSON.stringify(failedChecks, null, 2));
    assert.ok(result.checks.some((c) => c.status === STATUS.SKIPPED));
    const provenance = parseProvenanceStatus({});
    assert.equal(provenance.status, STATUS.SKIPPED);
    assert.ok(result.checks.some((c) => c.status === STATUS.SKIPPED));
  } finally {
    await fs.rm(workRoot, { recursive: true, force: true, maxRetries: 5 });
    await fs.rm(npmCache, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("smoke timeout surfaces FAILED mcp_smoke", async () => {
  const installDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-pub-acc-timeout-"),
  );
  const spawnImpl = async () => ({
    timedOut: true,
    code: null,
    signal: "SIGTERM",
    stdout: "",
    stderr: "",
  });
  try {
    const result = await runSmokeScript({
      installDir,
      scriptsRoot: path.join(ROOT, "scripts"),
      slug: "github",
      timeoutMs: 50,
      spawnImpl,
    });
    assert.equal(result.status, STATUS.FAILED);
    assert.match(result.evidence, /timed out/);
  } finally {
    await fs.rm(installDir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("stdout pollution in smoke fails mcp_smoke", async () => {
  const pollution = detectStdoutProtocolPollution("warning: leaked\n");
  assert.match(pollution, /pollution/);
});

test("runPublishedAcceptanceMatrix cleans work dirs by default", async () => {
  const targets = [
    {
      directory: "gmail",
      slug: "gmail",
      name: "@osva-ai/connector-gmail",
      version: "0.0.0-missing",
      binName: "osva-connector-gmail",
      wave: false,
    },
  ];
  const report = await runPublishedAcceptanceMatrix({
    repoRoot: ROOT,
    targets,
    concurrency: 1,
    reportPaths: {},
    deps: {
      runNpm: () => ({
        status: 1,
        stdout: "",
        stderr: "npm error code E404",
      }),
    },
  });
  assert.equal(report.workRoot, "[removed]");
  const md = renderMarkdownReport(report);
  assert.match(md, /Published package acceptance report/);
});

test("buildConnectorTargets includes B5 wave ordering and workspace versions", async () => {
  const wave = await buildConnectorTargets(ROOT, { waveOnly: true });
  assert.equal(wave.length, B5_WAVE_DIRECTORIES.length);
  assert.equal(wave[0].directory, "github");
  assert.match(wave[0].version, /^\d+\.\d+\.\d+$/);
  assert.equal(wave[0].wave, true);
});

test("evaluateDistTagLatest honors expect-latest flag", () => {
  const skipped = evaluateDistTagLatest("0.2.0", "0.1.0", false);
  assert.equal(skipped.status, STATUS.SKIPPED);
  const failed = evaluateDistTagLatest("0.2.0", "0.1.0", true);
  assert.equal(failed.status, STATUS.FAILED);
  const ok = evaluateDistTagLatest("0.1.0", "0.1.0", true);
  assert.equal(ok.status, STATUS.PASSED);
});

test("parseProvenanceStatus fails closed for B5 wave packages", () => {
  const wave = parseProvenanceStatus({}, { requireProvenance: true });
  assert.equal(wave.status, STATUS.FAILED);
  const legacy = parseProvenanceStatus({}, { requireProvenance: false });
  assert.equal(legacy.status, STATUS.SKIPPED);
});

test("summarizePackageChecks cannot PASS with failed or required skips", () => {
  const target = { wave: true, directory: "github" };
  const pass = summarizePackageChecks(
    [
      { id: CHECK.REGISTRY_VERSION, status: STATUS.PASSED },
      {
        id: CHECK.MCP_SMOKE,
        status: STATUS.SKIPPED,
        evidence: "install did not succeed",
      },
    ],
    target,
  );
  assert.equal(pass.overall, STATUS.FAILED);
  const optionalCli = summarizePackageChecks(
    [
      { id: CHECK.REGISTRY_VERSION, status: STATUS.PASSED },
      { id: CHECK.CLI_PROBE, status: STATUS.SKIPPED, evidence: "no fail-fast" },
    ],
    { wave: false },
  );
  assert.equal(optionalCli.overall, STATUS.PASSED);
});

test("successful fixture marks install_isolation passed", async () => {
  const workRoot = await fs.mkdtemp(path.join(os.tmpdir(), "osva-pub-iso-"));
  const npmCache = await fs.mkdtemp(
    path.join(os.tmpdir(), "osva-pub-npm-iso-"),
  );
  function fakeRunNpm(args, cwd) {
    if (args[0] === "install") {
      fsSyncTreeForInstall(
        cwd,
        "connector-gmail",
        "osva-connector-gmail",
        "0.1.0",
        "sha512-good",
      );
      return { status: 0, stdout: "", stderr: "" };
    }
    return { status: 0, stdout: '{"latest":"0.1.0"}', stderr: "" };
  }
  try {
    const result = await acceptPublishedPackage(
      {
        directory: "gmail",
        slug: "gmail",
        name: "@osva-ai/connector-gmail",
        version: "0.1.0",
        binName: "osva-connector-gmail",
        wave: false,
      },
      {
        repoRoot: ROOT,
        workRoot,
        npmCache,
        scriptsRoot: path.join(ROOT, "scripts"),
        expectedSdkVersion: "1.1.4",
        registryFixture: {
          version: "0.1.0",
          dist: { integrity: "sha512-good" },
        },
        runNpm: fakeRunNpm,
        spawnImpl: async () => ({
          timedOut: false,
          code: 0,
          stdout: "",
          stderr: "",
        }),
      },
    );
    const iso = result.checks.find((c) => c.id === CHECK.INSTALL_ISOLATION);
    assert.equal(iso?.status, STATUS.PASSED);
  } finally {
    await fs.rm(workRoot, { recursive: true, force: true, maxRetries: 5 });
    await fs.rm(npmCache, { recursive: true, force: true, maxRetries: 5 });
  }
});
