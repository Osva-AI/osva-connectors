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
import { INFRASTRUCTURE_DIRECTORIES } from "./live-provider-matrix-meta.mjs";
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
