import {
  csvHarnessInAllowlist,
  importDistModule,
  runInfrastructureScenarios,
} from "./connector-runner.mjs";

export async function runBigqueryScenarios(ctx) {
  return runInfrastructureScenarios(ctx, {
    directory: "bigquery",
    loadConfigExport: "loadBigqueryConfig",
    validateConfig(config) {
      const capped =
        config.maxBytesBilled === undefined ||
        config.maxBytesBilled <= 50_000_000;
      const datasetCount = config.allowedDatasets?.length ?? 0;
      return {
        ok: capped && datasetCount > 0,
        detail: `project=${config.projectId}; maxBytesBilled=${config.maxBytesBilled ?? "unset"}; allowedDatasets=${datasetCount}`,
      };
    },
    harnessAllowlistCheck() {
      const dataset =
        process.env.OSVA_LIVE_PROVIDER_BIGQUERY_TEST_DATASET?.trim();
      return csvHarnessInAllowlist(
        dataset,
        "OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS",
      );
    },
    async mockPolicyChecks(repoRoot) {
      const scope = await importDistModule(
        repoRoot,
        "bigquery",
        "resource-scope.js",
      );
      const checks = [];
      try {
        scope.assertDatasetAllowed(["sandbox_ds"], "other_ds");
        checks.push({
          id: "mock_policy_unauthorized_dataset",
          ok: false,
          detail: "expected dataset denial",
        });
      } catch {
        checks.push({
          id: "mock_policy_unauthorized_dataset",
          ok: true,
          detail: "unauthorized dataset rejected",
        });
      }
      try {
        scope.assertDataQueryAuthorized(
          undefined,
          undefined,
          "sandbox_ds",
          "users",
        );
        checks.push({
          id: "mock_policy_missing_cost_bounds",
          ok: false,
          detail: "data query without dataset allowlist must fail",
        });
      } catch {
        checks.push({
          id: "mock_policy_missing_cost_bounds",
          ok: true,
          detail:
            "missing dataset/table allowlists fail closed for data queries",
        });
      }
      return checks;
    },
    async runLiveRead({ timeoutMs }) {
      const datasetId =
        process.env.OSVA_LIVE_PROVIDER_BIGQUERY_TEST_DATASET.trim();
      const projectId = process.env.OSVA_CONNECTOR_BIGQUERY_PROJECT_ID.trim();
      const configMod = await import(
        new URL("../../../packages/bigquery/dist/config.js", import.meta.url)
          .href
      );
      const config = configMod.loadBigqueryConfig(process.env);
      const sdkMod = await import(
        new URL(
          "../../../packages/bigquery/dist/provider-sdk-client.js",
          import.meta.url,
        ).href
      );
      const client = sdkMod.createBigQuerySdkProviderClient({
        projectId: config.projectId,
        location: config.location,
        requestTimeoutMs: Math.min(config.requestTimeoutMs, timeoutMs, 45_000),
      });
      const listed = await client.listDatasets({ maxResults: 25 });
      const found = (listed.datasets ?? []).some(
        (entry) => entry.datasetId === datasetId,
      );
      const scope = csvHarnessInAllowlist(
        datasetId,
        "OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS",
      );
      return {
        ok: found && scope.ok,
        detail:
          found && scope.ok
            ? `dataset ${datasetId} visible in project ${projectId}`
            : `dataset ${datasetId} not found or not allowlisted`,
      };
    },
  });
}
