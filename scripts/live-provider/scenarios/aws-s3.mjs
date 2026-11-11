import {
  bucketInReadAllowlist,
  importDistModule,
  runInfrastructureScenarios,
} from "./connector-runner.mjs";

export async function runAwsS3Scenarios(ctx) {
  return runInfrastructureScenarios(ctx, {
    directory: "aws-s3",
    loadConfigExport: "loadS3Config",
    validateConfig(config) {
      const discoveryOff = !config.accountWideBucketDiscovery;
      const hasReadScope =
        config.allowedBucketsRead !== undefined &&
        Object.keys(config.allowedBucketsRead).length > 0;
      return {
        ok: discoveryOff && hasReadScope,
        detail: discoveryOff
          ? `region=${config.region}; readBuckets=${Object.keys(config.allowedBucketsRead ?? {}).length}`
          : "account-wide bucket discovery must be disabled for acceptance",
      };
    },
    harnessAllowlistCheck() {
      const bucket = process.env.OSVA_LIVE_PROVIDER_S3_TEST_BUCKET?.trim();
      return bucketInReadAllowlist(
        bucket,
        "OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ",
      );
    },
    async mockPolicyChecks(repoRoot) {
      const scope = await importDistModule(
        repoRoot,
        "aws-s3",
        "resource-scope.js",
      );
      const checks = [];
      try {
        scope.assertBucketAllowed({ sandbox: ["acceptance/"] }, "evil-bucket");
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
          "forbidden/",
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
      try {
        scope.assertBucketAllowed({}, "any-bucket");
        checks.push({
          id: "mock_policy_empty_allowlist",
          ok: false,
          detail: "empty allowlist must fail closed",
        });
      } catch {
        checks.push({
          id: "mock_policy_empty_allowlist",
          ok: true,
          detail: "empty allowlist fails closed",
        });
      }
      return checks;
    },
    async runLiveRead({ timeoutMs }) {
      const bucket = process.env.OSVA_LIVE_PROVIDER_S3_TEST_BUCKET.trim();
      const prefix =
        process.env.OSVA_LIVE_PROVIDER_S3_TEST_PREFIX?.trim() ?? "";
      const region = process.env.OSVA_CONNECTOR_S3_REGION.trim();
      const sdkMod = await import(
        new URL(
          "../../../packages/aws-s3/dist/provider-sdk-client.js",
          import.meta.url,
        ).href
      );
      const client = sdkMod.createS3SdkProviderClient({
        region,
        requestTimeoutMs: Math.min(timeoutMs, 30_000),
      });
      await client.headBucket(bucket);
      const listed = await client.listObjects({
        bucket,
        prefix: prefix || undefined,
        maxKeys: 10,
      });
      const scope = bucketInReadAllowlist(
        bucket,
        "OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ",
      );
      return {
        ok: scope.ok,
        detail: scope.ok
          ? `HeadBucket ok; bounded list keys=${listed.objects?.length ?? 0} prefix=${prefix || "(root)"}`
          : scope.detail,
      };
    },
  });
}
