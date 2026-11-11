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

export async function runAwsS3Scenarios(ctx) {
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
            cred.hasCredential ? null : "no AWS credential signal",
          ]
            .filter(Boolean)
            .join("; "),
    ),
  );

  const hasDist = await distEntryExists(repoRoot, "aws-s3");
  if (!hasDist) {
    results.push(
      makeScenarioResult(
        SCENARIO.PREFLIGHT_CONFIG,
        ACCEPTANCE_STATUS.SKIPPED,
        "dist/config.js missing — build @osva-ai/connector-aws-s3 for config parse check",
      ),
    );
  } else {
    try {
      const mod = await importConnectorConfig(repoRoot, "aws-s3");
      const config = mod.loadS3Config(process.env);
      const denyDiscovery = !config.accountWideBucketDiscovery;
      results.push(
        makeScenarioResult(
          SCENARIO.PREFLIGHT_CONFIG,
          denyDiscovery ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
          denyDiscovery
            ? `region=${config.region}; account-wide discovery disabled`
            : "account-wide bucket discovery must be disabled for acceptance",
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
        directory: "aws-s3",
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
      ),
    );
  } else if (
    !(await distEntryExists(repoRoot, "aws-s3", "dist/provider-sdk-client.js"))
  ) {
    results.push(
      makeScenarioResult(
        SCENARIO.LIVE_READ,
        ACCEPTANCE_STATUS.BLOCKED,
        "build connector-aws-s3 before live read",
      ),
    );
  } else {
    const bucket = process.env.OSVA_LIVE_PROVIDER_S3_TEST_BUCKET.trim();
    const prefix = process.env.OSVA_LIVE_PROVIDER_S3_TEST_PREFIX?.trim() ?? "";
    const region = process.env.OSVA_CONNECTOR_S3_REGION.trim();
    try {
      const sdkPath = new URL(
        "../../../packages/aws-s3/dist/provider-sdk-client.js",
        import.meta.url,
      );
      const sdkMod = await import(sdkPath.href);
      const client = sdkMod.createS3SdkProviderClient({
        region,
        requestTimeoutMs: Math.min(timeoutMs, 30_000),
      });
      await client.headBucket(bucket);
      const allowlistRaw =
        process.env.OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ ?? "";
      const allowlistOk = allowlistRaw.includes(bucket);
      results.push(
        makeScenarioResult(
          SCENARIO.LIVE_READ,
          allowlistOk ? ACCEPTANCE_STATUS.PASSED : ACCEPTANCE_STATUS.FAILED,
          allowlistOk
            ? `HeadBucket ok for ${bucket} prefix=${prefix || "(root)"}`
            : "bucket must appear in OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ for acceptance",
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

  const mutGate = liveMutationGate();
  results.push(
    makeScenarioResult(
      SCENARIO.LIVE_MUTATION,
      mutGate?.status ?? ACCEPTANCE_STATUS.NOT_RUN,
      mutGate?.evidence ?? "mutation scenarios deferred (pilot read-only)",
      "mutation",
    ),
  );

  return results;
}
