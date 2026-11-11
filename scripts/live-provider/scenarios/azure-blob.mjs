import {
  bucketInReadAllowlist,
  importDistModule,
  runInfrastructureScenarios,
} from "./connector-runner.mjs";

export async function runAzureBlobScenarios(ctx) {
  return runInfrastructureScenarios(ctx, {
    directory: "azure-blob",
    loadConfigExport: "loadAzureBlobConfig",
    validateConfig(config) {
      const discoveryOff = !config.accountWideContainerDiscovery;
      const hasReadScope =
        config.allowedContainersRead !== undefined &&
        Object.keys(config.allowedContainersRead).length > 0;
      const timeoutConfigured =
        Number.isInteger(config.requestTimeoutMs) &&
        config.requestTimeoutMs > 0;
      return {
        ok: discoveryOff && hasReadScope && timeoutConfigured,
        detail: `account=${config.accountName}; discovery=${config.accountWideContainerDiscovery}; timeoutMs=${config.requestTimeoutMs}; readContainers=${Object.keys(config.allowedContainersRead ?? {}).length}`,
      };
    },
    harnessAllowlistCheck() {
      const container =
        process.env.OSVA_LIVE_PROVIDER_AZURE_TEST_CONTAINER?.trim();
      return bucketInReadAllowlist(
        container,
        "OSVA_CONNECTOR_AZURE_BLOB_ALLOWED_CONTAINERS_READ",
      );
    },
    async mockPolicyChecks(repoRoot) {
      const scope = await importDistModule(
        repoRoot,
        "azure-blob",
        "resource-scope.js",
      );
      const checks = [];
      try {
        scope.assertContainerAllowed({ sandbox: ["acceptance/"] }, "other");
        checks.push({
          id: "mock_policy_unauthorized_container",
          ok: false,
          detail: "expected unauthorized container denial",
        });
      } catch {
        checks.push({
          id: "mock_policy_unauthorized_container",
          ok: true,
          detail: "unauthorized container rejected",
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
      return checks;
    },
    async runLiveRead({ repoRoot, timeoutMs }) {
      const container =
        process.env.OSVA_LIVE_PROVIDER_AZURE_TEST_CONTAINER.trim();
      const mod = await import(
        new URL(
          "../../../packages/azure-blob/dist/provider-sdk-client.js",
          import.meta.url,
        ).href
      );
      const configMod = await import(
        new URL("../../../packages/azure-blob/dist/config.js", import.meta.url)
          .href
      );
      const config = configMod.loadAzureBlobConfig(process.env);
      const client = mod.createAzureBlobSdkProviderClient({
        accountName: config.accountName,
        requestTimeoutMs: Math.min(config.requestTimeoutMs, timeoutMs, 30_000),
      });
      await client.headBucket(container);
      const scope = bucketInReadAllowlist(
        container,
        "OSVA_CONNECTOR_AZURE_BLOB_ALLOWED_CONTAINERS_READ",
      );
      return {
        ok: scope.ok,
        detail: scope.ok ? `headContainer ok for ${container}` : scope.detail,
      };
    },
  });
}
