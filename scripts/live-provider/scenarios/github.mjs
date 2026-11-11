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

export async function runGithubScenarios(ctx) {
  const { repoRoot, meta, timeoutMs, includeMock, spawnImpl } = ctx;
  const results = [];

  const policy = evaluateMutationPolicy();
  results.push(
    makeScenarioResult(
      SCENARIO.PREFLIGHT_POLICY,
      policy.ok ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
      policy.ok ? "mutation policy env off" : policy.violations.join(", "),
    ),
  );

  const cred = evaluateCredentialReadiness(meta);
  results.push(
    makeScenarioResult(
      SCENARIO.PREFLIGHT_CREDENTIALS,
      cred.ready ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.BLOCKED,
      cred.ready
        ? "token + allowlist env present"
        : `missing: ${cred.missingRequired.join(", ")}`,
    ),
  );

  const hasDist = await distEntryExists(repoRoot, "github");
  if (!hasDist) {
    results.push(
      makeScenarioResult(
        SCENARIO.PREFLIGHT_CONFIG,
        ACCEPTANCE_STATUS.SKIPPED,
        "dist/config.js missing — build connector-github first",
      ),
    );
  } else {
    try {
      const mod = await importConnectorConfig(repoRoot, "github");
      const config = mod.loadGithubConfig(process.env);
      const repoCount = config.allowedRepositories?.length ?? 0;
      results.push(
        makeScenarioResult(
          SCENARIO.PREFLIGHT_CONFIG,
          repoCount > 0 ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
          `allowedRepositories=${repoCount}`,
        ),
      );
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

  if (includeMock && meta.mockVitest?.length) {
    results.push(
      await runVitestFiles({
        repoRoot,
        directory: "github",
        testFiles: meta.mockVitest.filter(
          (f) => f !== "test/stdio-github.integration.test.ts" || includeMock,
        ),
        timeoutMs: Math.max(timeoutMs, 180_000),
        spawnImpl,
      }),
    );
  } else {
    results.push(
      makeScenarioResult(
        SCENARIO.MOCK_FIXTURE,
        ACCEPTANCE_STATUS.NOT_RUN,
        "mock vitest not requested",
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
      ),
    );
  } else {
    const owner = process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_OWNER.trim();
    const repo = process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_REPO.trim();
    const token = process.env.OSVA_CONNECTOR_GITHUB_TOKEN.trim();
    const allowlist =
      process.env.OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES ?? "";
    const slug = `${owner}/${repo}`;
    const allowed = allowlist.includes(slug) || allowlist.includes(repo);
    if (!allowed) {
      results.push(
        makeScenarioResult(
          SCENARIO.LIVE_READ,
          ACCEPTANCE_STATUS.FAILED,
          `repository ${slug} must be listed in OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES`,
        ),
      );
    } else {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(timeoutMs, 30_000),
      );
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
              "User-Agent": "osva-live-provider-acceptance",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          results.push(
            makeScenarioResult(
              SCENARIO.LIVE_READ,
              ACCEPTANCE_STATUS.FAILED,
              `GitHub API ${response.status}`,
            ),
          );
        } else {
          const body = await response.json();
          results.push(
            makeScenarioResult(
              SCENARIO.LIVE_READ,
              ACCEPTANCE_STATUS.PASSED,
              `repository.get ok: ${body.full_name ?? slug}`,
            ),
          );
        }
      } catch (error) {
        results.push(
          makeScenarioResult(
            SCENARIO.LIVE_READ,
            ACCEPTANCE_STATUS.FAILED,
            error instanceof Error ? error.message : String(error),
          ),
        );
      } finally {
        clearTimeout(timer);
      }
    }
  }

  const mutGate = liveMutationGate();
  results.push(
    makeScenarioResult(
      SCENARIO.LIVE_MUTATION,
      mutGate?.status ?? ACCEPTANCE_STATUS.NOT_RUN,
      mutGate?.evidence ?? "GitHub mutations deferred in B5.5A pilot",
      "mutation",
    ),
  );

  return results;
}
