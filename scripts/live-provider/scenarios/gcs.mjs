import {
  bucketInReadAllowlist,
  importDistModule,
  runInfrastructureScenarios,
} from "./connector-runner.mjs";

export async function runGcsScenarios(ctx) {
  return runInfrastructureScenarios(ctx, {
    directory: "gcs",
    loadConfigExport: "loadGcsConfig",
    validateConfig(config) {
      const discoveryOff = !config.accountWideBucketDiscovery;
      const hasReadScope =
        config.allowedBucketsRead !== undefined &&
        Object.keys(config.allowedBucketsRead).length > 0;
      return {
        ok: discoveryOff && hasReadScope,
        detail: `project=${config.projectId}; discovery=${config.accountWideBucketDiscovery}; readBuckets=${Object.keys(config.allowedBucketsRead ?? {}).length}`,
      };
    },
    harnessAllowlistCheck() {
      const bucket = process.env.OSVA_LIVE_PROVIDER_GCS_TEST_BUCKET?.trim();
      return bucketInReadAllowlist(
        bucket,
        "OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_READ",
      );
    },
    async mockPolicyChecks(repoRoot) {
      const scope = await importDistModule(
        repoRoot,
        "gcs",
        "resource-scope.js",
      );
      const checks = [];
      try {
        scope.assertBucketAllowed({ sandbox: ["acceptance/"] }, "prod-other");
        checks.push({
          id: "mock_policy_unauthorized_bucket",
          ok: false,
          detail: "expected unauthorized bucket denial",
        });
      } catch {
        checks.push({
          id: "mock_policy_unauthorized_bucket",
          ok: true,
          detail: "unauthorized bucket rejected",
        });
      }
      try {
        scope.assertListPrefixAllowed(
          { sandbox: ["acceptance/"] },
          "sandbox",
          "secret/",
        );
        checks.push({
          id: "mock_policy_unauthorized_prefix",
          ok: false,
          detail: "expected prefix denial",
        });
      } catch {
        checks.push({
          id: "mock_policy_unauthorized_prefix",
          ok: true,
          detail: "unauthorized list prefix rejected",
        });
      }
      return checks;
    },
    async runLiveRead({ repoRoot, timeoutMs }) {
      const bucket = process.env.OSVA_LIVE_PROVIDER_GCS_TEST_BUCKET.trim();
      const mod = await import(
        new URL(
          "../../../packages/gcs/dist/provider-sdk-client.js",
          import.meta.url,
        ).href
      );
      const configMod = await import(
        new URL("../../../packages/gcs/dist/config.js", import.meta.url).href
      );
      const config = configMod.loadGcsConfig(process.env);
      const client = mod.createGcsSdkProviderClient({
        projectId: config.projectId,
        requestTimeoutMs: Math.min(timeoutMs, 30_000),
      });
      await client.headBucket(bucket);
      const scope = bucketInReadAllowlist(
        bucket,
        "OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_READ",
      );
      return {
        ok: scope.ok,
        detail: scope.ok ? `HeadBucket ok for ${bucket}` : scope.detail,
      };
    },
  });
}
