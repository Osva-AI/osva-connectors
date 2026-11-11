import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { spawnWithWallClockDeadline } from "../../release/published-package-acceptance-core.mjs";
import {
  anyEnvReady,
  areMutationsApproved,
  envValueReady,
  isLiveExecutionEnabled,
} from "../live-provider-gates.mjs";
import { redactLiveProviderSecrets } from "../live-provider-redact.mjs";
import { ACCEPTANCE_STATUS } from "../live-provider-matrix-meta.mjs";

export const SCENARIO = Object.freeze({
  PREFLIGHT_CONFIG: "preflight_config",
  PREFLIGHT_POLICY: "preflight_mutation_policy",
  PREFLIGHT_CREDENTIALS: "preflight_credentials",
  MOCK_FIXTURE: "mock_fixture",
  LIVE_READ: "live_read",
  LIVE_MUTATION: "live_mutation",
});

export function makeScenarioResult(id, status, evidence = "", kind = "read") {
  return {
    id,
    status,
    evidence: redactLiveProviderSecrets(evidence).slice(0, 2_000),
    kind,
  };
}

export function connectorPackageName(directory) {
  return `@osva-ai/connector-${directory}`;
}

export async function distEntryExists(
  repoRoot,
  directory,
  rel = "dist/config.js",
) {
  const target = path.join(repoRoot, "packages", directory, rel);
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function importConnectorConfig(repoRoot, directory) {
  const configPath = path.join(
    repoRoot,
    "packages",
    directory,
    "dist",
    "config.js",
  );
  return import(pathToFileURL(configPath).href);
}

export function evaluateCredentialReadiness(meta) {
  const missingRequired = (meta.requiredEnv ?? []).filter(
    (name) => !envValueReady(name),
  );
  const credentialSignals = meta.credentialSignals ?? [];
  const hasCredential =
    credentialSignals.length === 0 ? true : anyEnvReady(credentialSignals);
  return {
    ready: missingRequired.length === 0 && hasCredential,
    missingRequired,
    hasCredential,
  };
}

export function liveReadGate(meta) {
  if (!isLiveExecutionEnabled()) {
    return {
      status: ACCEPTANCE_STATUS.BLOCKED,
      evidence: "Set OSVA_LIVE_PROVIDER_EXECUTE=1 to run live read scenarios.",
    };
  }
  const cred = evaluateCredentialReadiness(meta);
  if (!cred.ready) {
    const parts = [];
    if (cred.missingRequired.length > 0) {
      parts.push(`missing config env: ${cred.missingRequired.join(", ")}`);
    }
    if (!cred.hasCredential) {
      parts.push("missing provider credential signal");
    }
    return {
      status: ACCEPTANCE_STATUS.BLOCKED,
      evidence: parts.join("; "),
    };
  }
  const harnessMissing = (meta.liveHarnessEnv ?? []).filter(
    (name) => !envValueReady(name),
  );
  if (harnessMissing.length > 0) {
    return {
      status: ACCEPTANCE_STATUS.BLOCKED,
      evidence: `missing harness env: ${harnessMissing.join(", ")}`,
    };
  }
  return null;
}

export function liveMutationGate() {
  if (!isLiveExecutionEnabled()) {
    return {
      status: ACCEPTANCE_STATUS.NOT_RUN,
      evidence: "Live execution disabled.",
    };
  }
  if (!areMutationsApproved()) {
    return {
      status: ACCEPTANCE_STATUS.BLOCKED,
      evidence:
        "Mutations require OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED=1 and operator approval.",
    };
  }
  return null;
}

export async function runVitestFiles({
  repoRoot,
  directory,
  testFiles,
  timeoutMs,
  spawnImpl = spawnWithWallClockDeadline,
}) {
  const pkg = connectorPackageName(directory);
  const failures = [];
  for (const rel of testFiles) {
    const args = [
      "--filter",
      pkg,
      "exec",
      "vitest",
      "run",
      rel,
      "--reporter=dot",
    ];
    const result = await spawnImpl(
      "pnpm",
      args,
      {
        cwd: repoRoot,
        shell: process.platform === "win32",
        env: process.env,
      },
      timeoutMs,
    );
    if (result.timedOut) {
      failures.push(`${rel}: timed out after ${timeoutMs}ms`);
      continue;
    }
    if (result.code !== 0) {
      failures.push(
        `${rel}: exit ${result.code} — ${redactLiveProviderSecrets(result.stderr).slice(0, 200)}`,
      );
    }
  }
  if (failures.length > 0) {
    return makeScenarioResult(
      SCENARIO.MOCK_FIXTURE,
      ACCEPTANCE_STATUS.FAILED,
      failures.join(" | "),
    );
  }
  return makeScenarioResult(
    SCENARIO.MOCK_FIXTURE,
    ACCEPTANCE_STATUS.PASSED,
    `vitest passed: ${testFiles.join(", ")}`,
  );
}
