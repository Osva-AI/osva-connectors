import { evaluateMutationPolicy } from "../live-provider-gates.mjs";
import { ACCEPTANCE_STATUS } from "../live-provider-matrix-meta.mjs";
import {
  SCENARIO,
  distEntryExists,
  importConnectorConfig,
  evaluateCredentialReadiness,
  liveReadGate,
  makeScenarioResult,
  runVitestFiles,
} from "./common.mjs";

export async function runBigqueryScenarios(ctx) {
  const { repoRoot, meta, timeoutMs, includeMock, spawnImpl } = ctx;
  const results = [];

  const policy = evaluateMutationPolicy();
  results.push(
    makeScenarioResult(
      SCENARIO.PREFLIGHT_POLICY,
      policy.ok ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
      policy.ok
        ? "mutation policy env off"
        : `mutation env without approval: ${policy.violations.join(", ")}`,
    ),
  );

  const cred = evaluateCredentialReadiness(meta);
  results.push(
    makeScenarioResult(
      SCENARIO.PREFLIGHT_CREDENTIALS,
      cred.ready ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.BLOCKED,
      cred.ready
        ? "project id + ADC signal present"
        : `missing: ${cred.missingRequired.join(", ") || "GCP credentials"}`,
    ),
  );

  const hasDist = await distEntryExists(repoRoot, "bigquery");
  if (!hasDist) {
    results.push(
      makeScenarioResult(
        SCENARIO.PREFLIGHT_CONFIG,
        ACCEPTANCE_STATUS.SKIPPED,
        "dist/config.js missing — build connector-bigquery first",
      ),
    );
  } else {
    try {
      const mod = await importConnectorConfig(repoRoot, "bigquery");
      const config = mod.loadBigqueryConfig(process.env);
      const capped =
        config.maxBytesBilled === undefined ||
        config.maxBytesBilled <= 50_000_000;
      results.push(
        makeScenarioResult(
          SCENARIO.PREFLIGHT_CONFIG,
          capped ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
          `project=${config.projectId}; maxBytesBilled=${config.maxBytesBilled ?? "unset"}`,
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
        directory: "bigquery",
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
  } else if (
    !(await distEntryExists(
      repoRoot,
      "bigquery",
      "dist/provider-sdk-client.js",
    ))
  ) {
    results.push(
      makeScenarioResult(
        SCENARIO.LIVE_READ,
        ACCEPTANCE_STATUS.BLOCKED,
        "build connector-bigquery before live read",
      ),
    );
  } else {
    const projectId = process.env.OSVA_CONNECTOR_BIGQUERY_PROJECT_ID.trim();
    const datasetId =
      process.env.OSVA_LIVE_PROVIDER_BIGQUERY_TEST_DATASET.trim();
    try {
      const configMod = await importConnectorConfig(repoRoot, "bigquery");
      const config = configMod.loadBigqueryConfig(process.env);
      const sdkPath = new URL(
        "../../../packages/bigquery/dist/provider-sdk-client.js",
        import.meta.url,
      );
      const sdkMod = await import(sdkPath.href);
      const client = sdkMod.createBigQuerySdkProviderClient({
        projectId: config.projectId,
        location: config.location,
        requestTimeoutMs: Math.min(config.requestTimeoutMs, 45_000),
      });
      const listed = await client.listDatasets({ maxResults: 25 });
      const found = (listed.datasets ?? []).some(
        (entry) => entry.datasetId === datasetId,
      );
      results.push(
        makeScenarioResult(
          SCENARIO.LIVE_READ,
          found ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
          found
            ? `dataset ${datasetId} visible in project ${projectId}`
            : `dataset ${datasetId} not found (check allowlist and sandbox)`,
        ),
      );
    } catch (error) {
      results.push(
        makeScenarioResult(
          SCENARIO.LIVE_READ,
          ACCEPTANCE_STATUS.FAILED,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  results.push(
    makeScenarioResult(
      SCENARIO.LIVE_MUTATION,
      ACCEPTANCE_STATUS.NOT_RUN,
      "BigQuery connector remains read-only in B5.5A pilot",
      "mutation",
    ),
  );

  return results;
}
