import {
  csvHarnessInAllowlist,
  importDistModule,
  runInfrastructureScenarios,
} from "./connector-runner.mjs";

export async function runPineconeScenarios(ctx) {
  return runInfrastructureScenarios(ctx, {
    directory: "pinecone",
    loadConfigExport: "loadPineconeConfig",
    validateConfig(config) {
      const indexes = config.allowedIndexes?.length ?? 0;
      const writeOff = !config.writeEnabled;
      return {
        ok: indexes > 0 && writeOff,
        detail: `allowedIndexes=${indexes}; writeEnabled=${config.writeEnabled}; timeoutMs=${config.requestTimeoutMs}`,
      };
    },
    harnessAllowlistCheck() {
      const index = process.env.OSVA_LIVE_PROVIDER_PINECONE_TEST_INDEX?.trim();
      return csvHarnessInAllowlist(
        index,
        "OSVA_CONNECTOR_PINECONE_ALLOWED_INDEXES",
      );
    },
    async mockPolicyChecks(repoRoot) {
      const allow = await importDistModule(
        repoRoot,
        "pinecone",
        "allowlist.js",
      );
      const allowlist = allow.createIndexAllowlist(["sandbox-index"]);
      try {
        allow.assertIndexAllowed(allowlist, "prod-index");
        return [
          {
            id: "mock_policy_unauthorized_index",
            ok: false,
            detail: "expected index denial",
          },
        ];
      } catch {
        return [
          {
            id: "mock_policy_unauthorized_index",
            ok: true,
            detail: "unauthorized index rejected",
          },
        ];
      }
    },
    async runLiveRead({ timeoutMs }) {
      const index = process.env.OSVA_LIVE_PROVIDER_PINECONE_TEST_INDEX.trim();
      const mod = await import(
        new URL(
          "../../../packages/pinecone/dist/pinecone-rest-client.js",
          import.meta.url,
        ).href
      );
      const configMod = await import(
        new URL("../../../packages/pinecone/dist/config.js", import.meta.url)
          .href
      );
      const config = configMod.loadPineconeConfig(process.env);
      const client = mod.createPineconeRestClient({
        apiKey: config.apiKey,
        requestTimeoutMs: Math.min(config.requestTimeoutMs, timeoutMs, 30_000),
      });
      const controller = new AbortController();
      await client.describeIndex(index, controller.signal);
      const scope = csvHarnessInAllowlist(
        index,
        "OSVA_CONNECTOR_PINECONE_ALLOWED_INDEXES",
      );
      return {
        ok: scope.ok,
        detail: scope.ok ? `describeIndex ok for ${index}` : scope.detail,
      };
    },
  });
}
