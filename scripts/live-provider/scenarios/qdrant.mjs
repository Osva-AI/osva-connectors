import {
  csvHarnessInAllowlist,
  importDistModule,
  runInfrastructureScenarios,
} from "./connector-runner.mjs";

export async function runQdrantScenarios(ctx) {
  return runInfrastructureScenarios(ctx, {
    directory: "qdrant",
    loadConfigExport: "loadQdrantConfig",
    validateConfig(config) {
      const allowlistLen = config.allowedCollections?.length ?? 0;
      const writeOff = !config.writeEnabled;
      return {
        ok: allowlistLen > 0 && writeOff,
        detail: `url host configured; allowedCollections=${allowlistLen}; writeEnabled=${config.writeEnabled}`,
      };
    },
    harnessAllowlistCheck() {
      const collection =
        process.env.OSVA_LIVE_PROVIDER_QDRANT_TEST_COLLECTION?.trim();
      return csvHarnessInAllowlist(
        collection,
        "OSVA_CONNECTOR_QDRANT_ALLOWED_COLLECTIONS",
      );
    },
    async mockPolicyChecks(repoRoot) {
      const allow = await importDistModule(repoRoot, "qdrant", "allowlist.js");
      const allowlist = allow.createCollectionAllowlist(["sandbox"]);
      try {
        allow.assertCollectionAllowed(allowlist, "attacker");
        return [
          {
            id: "mock_policy_unauthorized_collection",
            ok: false,
            detail: "expected collection denial",
          },
        ];
      } catch {
        return [
          {
            id: "mock_policy_unauthorized_collection",
            ok: true,
            detail: "unauthorized collection rejected",
          },
        ];
      }
    },
    async runLiveRead({ timeoutMs }) {
      const collection =
        process.env.OSVA_LIVE_PROVIDER_QDRANT_TEST_COLLECTION.trim();
      const mod = await import(
        new URL(
          "../../../packages/qdrant/dist/qdrant-rest-client.js",
          import.meta.url,
        ).href
      );
      const configMod = await import(
        new URL("../../../packages/qdrant/dist/config.js", import.meta.url).href
      );
      const config = configMod.loadQdrantConfig(process.env);
      const client = mod.createQdrantRestClient({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        requestTimeoutMs: Math.min(config.requestTimeoutMs, timeoutMs, 30_000),
      });
      const controller = new AbortController();
      await client.getCollection(collection, controller.signal);
      const scope = csvHarnessInAllowlist(
        collection,
        "OSVA_CONNECTOR_QDRANT_ALLOWED_COLLECTIONS",
      );
      return {
        ok: scope.ok,
        detail: scope.ok ? `getCollection ok for ${collection}` : scope.detail,
      };
    },
  });
}
