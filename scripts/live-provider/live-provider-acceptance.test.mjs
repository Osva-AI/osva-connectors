import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

import {
  ACCEPTANCE_STATUS,
  buildLiveProviderMatrix,
  evaluateExitCode,
  formatLiveProviderMatrixDoc,
  renderLiveProviderMatrixDoc,
  runConnectorLiveAcceptance,
  summarizeScenarioStatuses,
} from "./live-provider-acceptance-core.mjs";
import {
  evaluateMutationPolicy,
  isLiveExecutionEnabled,
} from "./live-provider-gates.mjs";
import {
  INFRASTRUCTURE_DIRECTORIES,
  SAAS_DIRECTORIES,
} from "./live-provider-matrix-meta.mjs";
import {
  evaluateMockMutationSafety,
  liveMutationGate,
} from "./scenarios/common.mjs";
import {
  auditAllConnectorMutationInventories,
  assertToolAuthorizedForLiveMutation,
  classifyToolMutation,
} from "./mutation-inventory-audit.mjs";
import { loadConnectorPackages } from "../release/load-connector-packages.mjs";
import {
  MUTATION_CLASS,
  MUTATION_INVENTORY,
  verifyMutationInventory,
} from "./mutation-inventory.mjs";
import { liveReadGate } from "./scenarios/common.mjs";
import { redactLiveProviderSecrets } from "./live-provider-redact.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);

test("buildLiveProviderMatrix returns 45 connectors sorted by risk group", async () => {
  const matrix = await buildLiveProviderMatrix(ROOT);
  assert.equal(matrix.length, 45);
  const storageIndex = matrix.findIndex((r) => r.directory === "aws-s3");
  const amplitudeIndex = matrix.findIndex((r) => r.directory === "amplitude");
  assert.ok(storageIndex >= 0);
  assert.ok(amplitudeIndex > storageIndex);
  assert.equal(matrix[0].acceptanceStatus, ACCEPTANCE_STATUS.NOT_RUN);
});

test("evaluateMutationPolicy fails when write env enabled without approval", () => {
  const prevMutations = process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED;
  const prevCreate = process.env.OSVA_CONNECTOR_S3_CREATE_ENABLED;
  try {
    delete process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED;
    process.env.OSVA_CONNECTOR_S3_CREATE_ENABLED = "true";
    const result = evaluateMutationPolicy();
    assert.equal(result.ok, false);
    assert.ok(result.violations.includes("OSVA_CONNECTOR_S3_CREATE_ENABLED"));
  } finally {
    if (prevMutations === undefined) {
      delete process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED;
    } else {
      process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED = prevMutations;
    }
    if (prevCreate === undefined) {
      delete process.env.OSVA_CONNECTOR_S3_CREATE_ENABLED;
    } else {
      process.env.OSVA_CONNECTOR_S3_CREATE_ENABLED = prevCreate;
    }
  }
});

test("redactLiveProviderSecrets strips github pat patterns", () => {
  const out = redactLiveProviderSecrets(
    "token github_pat_abcdefghijklmnopqrstuvwxyz0123456789",
  );
  assert.doesNotMatch(out, /github_pat_[a-z0-9_]+/i);
  assert.match(out, /\[redacted\]/);
});

test("pilot preflight without credentials marks live read BLOCKED", async () => {
  const prevExecute = process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  delete process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  delete process.env.OSVA_CONNECTOR_S3_REGION;
  const result = await runConnectorLiveAcceptance("aws-s3", {
    repoRoot: ROOT,
    timeoutMs: 5_000,
    includeMock: false,
    spawnImpl: async () => ({
      timedOut: false,
      code: 0,
      stdout: "",
      stderr: "",
    }),
  });
  const live = result.scenarios.find((s) => s.id === "live_read");
  assert.ok(live);
  assert.equal(live.status, ACCEPTANCE_STATUS.BLOCKED);
  if (prevExecute !== undefined) {
    process.env.OSVA_LIVE_PROVIDER_EXECUTE = prevExecute;
  }
});

test("summarizeScenarioStatuses never upgrades NOT_RUN to PASSED overall", () => {
  const summary = summarizeScenarioStatuses([
    { id: "a", status: ACCEPTANCE_STATUS.PASSED },
    { id: "b", status: ACCEPTANCE_STATUS.NOT_RUN },
  ]);
  assert.equal(summary.acceptanceStatus, ACCEPTANCE_STATUS.NOT_RUN);
});

test("evaluateExitCode fails on preflight failure", () => {
  const code = evaluateExitCode({
    packages: [
      {
        acceptanceStatus: ACCEPTANCE_STATUS.BLOCKED,
        scenarios: [
          { id: "preflight_config", status: ACCEPTANCE_STATUS.FAILED },
        ],
      },
    ],
  });
  assert.equal(code, 1);
});

test("formatLiveProviderMatrixDoc matches Prettier check and is idempotent", async () => {
  const matrix = await buildLiveProviderMatrix(ROOT);
  const matrixPath = path.join(
    ROOT,
    "docs",
    "operations",
    "live-provider-acceptance-matrix.md",
  );
  const raw = `${renderLiveProviderMatrixDoc(matrix)}\n`;
  const once = await formatLiveProviderMatrixDoc(raw, matrixPath);
  const twice = await formatLiveProviderMatrixDoc(once, matrixPath);
  assert.equal(once, twice);
  assert.equal(
    await prettier.check(once, { filepath: matrixPath }),
    true,
    "formatted matrix must pass prettier.check",
  );
  assert.equal(matrix.length, 45);
  assert.match(once, /@osva-ai\/connector-aws-s3/);
});

test("B5.5B infrastructure matrix metadata lists eight connectors", () => {
  assert.equal(INFRASTRUCTURE_DIRECTORIES.length, 8);
  assert.deepEqual(
    [...INFRASTRUCTURE_DIRECTORIES].sort(),
    [
      "aws-s3",
      "azure-blob",
      "bigquery",
      "gcs",
      "pinecone",
      "postgres",
      "qdrant",
      "snowflake",
    ].sort(),
  );
});

test("live execution gate cannot be bypassed at scenario boundary", () => {
  const prev = process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  delete process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  assert.equal(isLiveExecutionEnabled(), false);
  const gate = liveReadGate({
    requiredEnv: ["OSVA_CONNECTOR_S3_REGION"],
    credentialSignals: ["AWS_ACCESS_KEY_ID"],
    liveHarnessEnv: ["OSVA_LIVE_PROVIDER_S3_TEST_BUCKET"],
  });
  assert.ok(gate);
  assert.equal(gate.status, ACCEPTANCE_STATUS.BLOCKED);
  if (prev !== undefined) {
    process.env.OSVA_LIVE_PROVIDER_EXECUTE = prev;
  }
});

test("B5.5C SaaS matrix lists 37 connectors", () => {
  assert.equal(SAAS_DIRECTORIES.length, 37);
  assert.ok(SAAS_DIRECTORIES.includes("stripe"));
  assert.ok(SAAS_DIRECTORIES.includes("github"));
  assert.ok(!SAAS_DIRECTORIES.includes("aws-s3"));
});

test("mutation inventory classifies GitHub write tools", () => {
  const inv = MUTATION_INVENTORY.github;
  assert.ok(
    inv["github.issue.create"].includes(MUTATION_CLASS.REVERSIBLE_MUTATION),
  );
  const check = verifyMutationInventory("github");
  assert.equal(check.ok, true);
});

test("live mutation runner stays disabled under approval flags", () => {
  const savedExecute = process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  const savedMut = process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED;
  const savedDest = process.env.OSVA_LIVE_PROVIDER_DESTRUCTIVE_APPROVED;
  const savedRunner = process.env.OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED;
  delete process.env.OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED;
  process.env.OSVA_LIVE_PROVIDER_EXECUTE = "1";
  process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED = "1";
  process.env.OSVA_LIVE_PROVIDER_DESTRUCTIVE_APPROVED = "1";
  try {
    const safety = evaluateMockMutationSafety();
    assert.equal(safety.ok, true);
    const gate = liveMutationGate();
    assert.ok(gate);
    assert.notEqual(gate.status, "PASSED");
  } finally {
    if (savedExecute === undefined) {
      delete process.env.OSVA_LIVE_PROVIDER_EXECUTE;
    } else {
      process.env.OSVA_LIVE_PROVIDER_EXECUTE = savedExecute;
    }
    if (savedMut === undefined) {
      delete process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED;
    } else {
      process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED = savedMut;
    }
    if (savedDest === undefined) {
      delete process.env.OSVA_LIVE_PROVIDER_DESTRUCTIVE_APPROVED;
    } else {
      process.env.OSVA_LIVE_PROVIDER_DESTRUCTIVE_APPROVED = savedDest;
    }
    if (savedRunner === undefined) {
      delete process.env.OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED;
    } else {
      process.env.OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED = savedRunner;
    }
  }
});

test("SaaS preflight without credentials keeps live_read BLOCKED", async () => {
  const prevExecute = process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  delete process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  const sample = ["stripe", "shopify", "slack"];
  for (const directory of sample) {
    const result = await runConnectorLiveAcceptance(directory, {
      repoRoot: ROOT,
      timeoutMs: 5_000,
      includeMock: false,
      spawnImpl: async () => ({
        timedOut: false,
        code: 0,
        stdout: "",
        stderr: "",
      }),
    });
    const live = result.scenarios.find((s) => s.id === "live_read");
    assert.equal(live?.status, ACCEPTANCE_STATUS.BLOCKED, directory);
    const liveMut = result.scenarios.find((s) => s.id === "live_mutation");
    assert.equal(liveMut?.status, ACCEPTANCE_STATUS.NOT_RUN, directory);
  }
  if (prevExecute !== undefined) {
    process.env.OSVA_LIVE_PROVIDER_EXECUTE = prevExecute;
  }
});

test("infrastructure preflight without credentials keeps live_read BLOCKED", async () => {
  const prevExecute = process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  delete process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  for (const directory of INFRASTRUCTURE_DIRECTORIES) {
    const result = await runConnectorLiveAcceptance(directory, {
      repoRoot: ROOT,
      timeoutMs: 5_000,
      includeMock: false,
      spawnImpl: async () => ({
        timedOut: false,
        code: 0,
        stdout: "",
        stderr: "",
      }),
    });
    const live = result.scenarios.find((s) => s.id === "live_read");
    assert.ok(live, `${directory} missing live_read scenario`);
    assert.equal(
      live.status,
      ACCEPTANCE_STATUS.BLOCKED,
      `${directory} live_read should be BLOCKED`,
    );
  }
  if (prevExecute !== undefined) {
    process.env.OSVA_LIVE_PROVIDER_EXECUTE = prevExecute;
  }
});

test("B5.5D registry: every package has metadata and unique directory id", async () => {
  const packages = await loadConnectorPackages(ROOT);
  assert.equal(packages.length, 45);
  const dirs = packages.map((p) => p.directory);
  assert.equal(new Set(dirs).size, 45);
  const matrix = await buildLiveProviderMatrix(ROOT);
  for (const pkg of packages) {
    const row = matrix.find((r) => r.directory === pkg.directory);
    assert.ok(row, `missing matrix row for ${pkg.directory}`);
    assert.equal(row.name, pkg.name);
    assert.equal(row.version, pkg.version);
  }
});

test("B5.5D mutation inventory aligns with all declared MCP tools", async () => {
  const audits = await auditAllConnectorMutationInventories(ROOT);
  assert.equal(audits.length, 45);
  const bad = audits.filter((a) => !a.ok);
  assert.equal(
    bad.length,
    0,
    bad.map((b) => `${b.directory}: ${b.detail}`).join("; "),
  );
});

test("unknown tool classification fails closed for live mutation", () => {
  const unknown = classifyToolMutation("github", "github.nonexistent.tool");
  assert.equal(unknown.known, false);
  assert.equal(unknown.failClosed, true);
  const denied = assertToolAuthorizedForLiveMutation(
    "github",
    "github.issue.create",
  );
  assert.equal(denied.ok, false);
  const read = assertToolAuthorizedForLiveMutation(
    "github",
    "github.repository.get",
  );
  assert.equal(read.ok, true);
});

test("mock github acceptance does not invoke fetch without live gate", async () => {
  const prevExecute = process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  const prevToken = process.env.OSVA_CONNECTOR_GITHUB_TOKEN;
  const prevOwner = process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_OWNER;
  delete process.env.OSVA_LIVE_PROVIDER_EXECUTE;
  process.env.OSVA_CONNECTOR_GITHUB_TOKEN = "github_pat_testtoken0000000000";
  process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_OWNER = "evil";
  process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_REPO = "repo";
  process.env.OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES = "octo/sandbox";
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    fetchCalls += 1;
    return originalFetch(...args);
  };
  try {
    const result = await runConnectorLiveAcceptance("github", {
      repoRoot: ROOT,
      timeoutMs: 5_000,
      includeMock: false,
      spawnImpl: async () => ({
        timedOut: false,
        code: 0,
        stdout: "",
        stderr: "",
      }),
    });
    const live = result.scenarios.find((s) => s.id === "live_read");
    assert.equal(live?.status, ACCEPTANCE_STATUS.BLOCKED);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevExecute === undefined) {
      delete process.env.OSVA_LIVE_PROVIDER_EXECUTE;
    } else {
      process.env.OSVA_LIVE_PROVIDER_EXECUTE = prevExecute;
    }
    if (prevToken === undefined) {
      delete process.env.OSVA_CONNECTOR_GITHUB_TOKEN;
    } else {
      process.env.OSVA_CONNECTOR_GITHUB_TOKEN = prevToken;
    }
    if (prevOwner === undefined) {
      delete process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_OWNER;
    } else {
      process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_OWNER = prevOwner;
    }
  }
});

test("evaluateExitCode passes when live scenarios blocked but preflight ok", () => {
  const code = evaluateExitCode({
    packages: [
      {
        acceptanceStatus: ACCEPTANCE_STATUS.BLOCKED,
        scenarios: [
          { id: "preflight_config", status: ACCEPTANCE_STATUS.PASSED },
          { id: "live_read", status: ACCEPTANCE_STATUS.BLOCKED },
        ],
      },
    ],
  });
  assert.equal(code, 0);
});

test("matrix-only CLI regeneration is stable under prettier --check", async () => {
  const matrixPath = path.join(
    ROOT,
    "docs",
    "operations",
    "live-provider-acceptance-matrix.md",
  );
  const script = path.join(
    ROOT,
    "scripts",
    "live-provider",
    "live-provider-acceptance.mjs",
  );
  const run = () =>
    spawnSync(process.execPath, [script, "--matrix-only"], {
      cwd: ROOT,
      encoding: "utf8",
    });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const afterFirst = await fs.readFile(matrixPath, "utf8");
  assert.equal(
    await prettier.check(afterFirst, { filepath: matrixPath }),
    true,
  );
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  const afterSecond = await fs.readFile(matrixPath, "utf8");
  assert.equal(afterFirst, afterSecond, "regeneration must be byte-stable");
  assert.equal(
    await prettier.check(afterSecond, { filepath: matrixPath }),
    true,
  );
});
