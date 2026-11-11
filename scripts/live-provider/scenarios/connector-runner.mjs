import { pathToFileURL } from "node:url";
import path from "node:path";

import { verifyMutationInventoryPreflight } from "../mutation-inventory-audit.mjs";
import { evaluateMutationPolicy } from "../live-provider-gates.mjs";
import { ACCEPTANCE_STATUS } from "../live-provider-matrix-meta.mjs";
import {
  SCENARIO,
  distEntryExists,
  importConnectorConfig,
  evaluateCredentialReadiness,
  liveReadGate,
  liveMutationGate,
  makeScenarioResult,
  runVitestFiles,
} from "./common.mjs";

export async function importDistModule(repoRoot, directory, rel) {
  const target = path.join(repoRoot, "packages", directory, "dist", rel);
  return import(pathToFileURL(target).href);
}

/**
 * Run B5.5B infrastructure acceptance scenarios for one connector.
 *
 * @param {object} ctx
 * @param {{
 *   directory: string;
 *   loadConfigExport: string;
 *   validateConfig: (config: object) => { ok: boolean; detail: string };
 *   harnessAllowlistCheck?: () => { ok: boolean; detail: string };
 *   mockPolicyChecks?: (repoRoot: string) => Promise<Array<{ id: string; ok: boolean; detail: string }>>;
 *   runLiveRead?: (ctx: object) => Promise<{ ok: boolean; detail: string }>;
 * }} spec
 */
export async function runInfrastructureScenarios(ctx, spec) {
  const { repoRoot, meta, timeoutMs, includeMock, spawnImpl } = ctx;
  const results = [];

  const policy = evaluateMutationPolicy();
  results.push(
    makeScenarioResult(
      SCENARIO.PREFLIGHT_POLICY,
      policy.ok ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
      policy.ok
        ? "mutation policy env off (default safe)"
        : `mutation env set without approval: ${policy.violations.join(", ")}`,
    ),
  );

  const cred = evaluateCredentialReadiness(meta);
  results.push(
    makeScenarioResult(
      SCENARIO.PREFLIGHT_CREDENTIALS,
      cred.ready ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.BLOCKED,
      cred.ready
        ? "connector + credential signals present"
        : [
            cred.missingRequired.length
              ? `missing: ${cred.missingRequired.join(", ")}`
              : null,
            cred.hasCredential ? null : "missing provider credential signal",
          ]
            .filter(Boolean)
            .join("; "),
    ),
  );

  const inventory = await verifyMutationInventoryPreflight(
    repoRoot,
    spec.directory,
  );
  results.push(
    makeScenarioResult(
      SCENARIO.PREFLIGHT_MUTATION_INVENTORY,
      inventory.ok ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
      inventory.coverage
        ? `${inventory.coverage}: ${inventory.detail}`
        : inventory.detail,
      "preflight",
    ),
  );

  const hasDist = await distEntryExists(repoRoot, spec.directory);
  if (!hasDist) {
    results.push(
      makeScenarioResult(
        SCENARIO.PREFLIGHT_CONFIG,
        ACCEPTANCE_STATUS.SKIPPED,
        `dist/config.js missing — build @osva-ai/connector-${spec.directory} first`,
      ),
    );
  } else {
    try {
      const mod = await importConnectorConfig(repoRoot, spec.directory);
      const loadFn = mod[spec.loadConfigExport];
      if (typeof loadFn !== "function") {
        results.push(
          makeScenarioResult(
            SCENARIO.PREFLIGHT_CONFIG,
            ACCEPTANCE_STATUS.FAILED,
            `export ${spec.loadConfigExport} missing on config module`,
          ),
        );
      } else {
        const config = loadFn(process.env);
        const verdict = spec.validateConfig(config);
        results.push(
          makeScenarioResult(
            SCENARIO.PREFLIGHT_CONFIG,
            verdict.ok ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
            verdict.detail,
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(
        makeScenarioResult(
          SCENARIO.PREFLIGHT_CONFIG,
          cred.ready ? ACCEPTANCE_STATUS.FAILED : ACCEPTANCE_STATUS.PASSED,
          cred.ready
            ? message
            : `fail-closed without sandbox config: ${message}`,
        ),
      );
    }
  }

  if (spec.harnessAllowlistCheck) {
    const harnessMissing = (meta.liveHarnessEnv ?? []).filter(
      (name) => !String(process.env[name] ?? "").trim(),
    );
    if (harnessMissing.length > 0) {
      results.push(
        makeScenarioResult(
          "preflight_harness_scope",
          ACCEPTANCE_STATUS.BLOCKED,
          `harness env not set: ${harnessMissing.join(", ")}`,
        ),
      );
    } else if (!cred.ready) {
      results.push(
        makeScenarioResult(
          "preflight_harness_scope",
          ACCEPTANCE_STATUS.BLOCKED,
          "connector credentials not ready for harness scope validation",
        ),
      );
    } else {
      try {
        const verdict = spec.harnessAllowlistCheck();
        results.push(
          makeScenarioResult(
            "preflight_harness_scope",
            verdict.ok ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
            verdict.detail,
          ),
        );
      } catch (error) {
        results.push(
          makeScenarioResult(
            "preflight_harness_scope",
            ACCEPTANCE_STATUS.FAILED,
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    }
  }

  if (spec.mockPolicyChecks) {
    if (!(await distEntryExists(repoRoot, spec.directory, "dist/config.js"))) {
      results.push(
        makeScenarioResult(
          "mock_policy_allowlist",
          ACCEPTANCE_STATUS.SKIPPED,
          "build connector package to run in-process mock policy checks",
        ),
      );
    } else {
      try {
        const checks = await spec.mockPolicyChecks(repoRoot);
        for (const check of checks) {
          results.push(
            makeScenarioResult(
              check.id,
              check.ok ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
              check.detail,
              "mock",
            ),
          );
        }
      } catch (error) {
        results.push(
          makeScenarioResult(
            "mock_policy_allowlist",
            ACCEPTANCE_STATUS.FAILED,
            error instanceof Error ? error.message : String(error),
            "mock",
          ),
        );
      }
    }
  }

  if (includeMock && meta.mockVitest?.length) {
    results.push(
      await runVitestFiles({
        repoRoot,
        directory: spec.directory,
        testFiles: meta.mockVitest,
        timeoutMs,
        spawnImpl,
      }),
    );
  } else {
    results.push(
      makeScenarioResult(
        SCENARIO.MOCK_FIXTURE,
        ACCEPTANCE_STATUS.NOT_RUN,
        "mock vitest not requested (use --mock or OSVA_LIVE_PROVIDER_RUN_MOCK_FIXTURES=1)",
      ),
    );
  }

  const readGate = liveReadGate(meta);
  if (readGate) {
    results.push(
      makeScenarioResult(
        SCENARIO.LIVE_READ,
        readGate.status,
        readGate.evidence,
        "live_read",
      ),
    );
  } else if (spec.runLiveRead) {
    try {
      const outcome = await spec.runLiveRead(ctx);
      results.push(
        makeScenarioResult(
          SCENARIO.LIVE_READ,
          outcome.ok ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
          outcome.detail,
          "live_read",
        ),
      );
    } catch (error) {
      results.push(
        makeScenarioResult(
          SCENARIO.LIVE_READ,
          ACCEPTANCE_STATUS.FAILED,
          error instanceof Error ? error.message : String(error),
          "live_read",
        ),
      );
    }
  } else {
    results.push(
      makeScenarioResult(
        SCENARIO.LIVE_READ,
        ACCEPTANCE_STATUS.BLOCKED,
        "live read runner not implemented",
        "live_read",
      ),
    );
  }

  const mutGate = liveMutationGate();
  results.push(
    makeScenarioResult(
      SCENARIO.LIVE_MUTATION,
      mutGate?.status ?? ACCEPTANCE_STATUS.NOT_RUN,
      mutGate?.evidence ??
        "mutation scenarios deferred (infrastructure read-only)",
      "mutation",
    ),
  );

  return results;
}

export function bucketInReadAllowlist(bucket, envVar) {
  const raw = process.env[envVar] ?? "";
  if (!raw.trim()) {
    return {
      ok: false,
      detail: `${envVar} must be set for acceptance harness scope`,
    };
  }
  try {
    const map = JSON.parse(raw);
    if (typeof map !== "object" || map === null) {
      return { ok: false, detail: `${envVar} must be JSON object` };
    }
    const allowed = Object.prototype.hasOwnProperty.call(map, bucket);
    return {
      ok: allowed,
      detail: allowed
        ? `test bucket ${bucket} present in ${envVar}`
        : `test bucket ${bucket} missing from ${envVar}`,
    };
  } catch {
    return { ok: false, detail: `${envVar} is not valid JSON` };
  }
}

export function csvHarnessInAllowlist(value, envVar) {
  const raw = process.env[envVar] ?? "";
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const ok = parts.includes(value);
  return {
    ok,
    detail: ok
      ? `${value} listed in ${envVar}`
      : `${value} must appear in ${envVar}`,
  };
}
