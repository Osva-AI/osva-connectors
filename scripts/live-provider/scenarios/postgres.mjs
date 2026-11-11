import {
  csvHarnessInAllowlist,
  importDistModule,
  runInfrastructureScenarios,
} from "./connector-runner.mjs";

export async function runPostgresScenarios(ctx) {
  return runInfrastructureScenarios(ctx, {
    directory: "postgres",
    loadConfigExport: "loadPostgresConfig",
    validateConfig(config) {
      const schemaCount = config.allowedSchemas?.length ?? 0;
      const timeoutsOk =
        config.queryTimeoutMs > 0 && config.connectTimeoutMs > 0;
      return {
        ok: schemaCount > 0 && timeoutsOk,
        detail: `allowedSchemas=${schemaCount}; queryTimeoutMs=${config.queryTimeoutMs}; connectTimeoutMs=${config.connectTimeoutMs}`,
      };
    },
    harnessAllowlistCheck() {
      const schema =
        process.env.OSVA_LIVE_PROVIDER_POSTGRES_ALLOWLIST_SCHEMA?.trim();
      return csvHarnessInAllowlist(
        schema,
        "OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS",
      );
    },
    async mockPolicyChecks(repoRoot) {
      const policy = await importDistModule(
        repoRoot,
        "postgres",
        "allowed-schemas.js",
      );
      try {
        policy.assertSchemaAllowedByPolicy("secret", ["acceptance"]);
        return [
          {
            id: "mock_policy_unauthorized_schema",
            ok: false,
            detail: "expected schema denial",
          },
        ];
      } catch {
        return [
          {
            id: "mock_policy_unauthorized_schema",
            ok: true,
            detail: "unauthorized schema rejected",
          },
        ];
      }
    },
    async runLiveRead() {
      const clientMod = await import(
        new URL(
          "../../../packages/postgres/dist/postgres-client.js",
          import.meta.url,
        ).href
      );
      const configMod = await import(
        new URL("../../../packages/postgres/dist/config.js", import.meta.url)
          .href
      );
      const config = configMod.loadPostgresConfig(process.env);
      const pool = clientMod.createPostgresPool(config);
      const database = clientMod.createPgDatabase(pool, config);
      try {
        await database.query("SELECT 1 AS live_acceptance");
        return { ok: true, detail: "connectivity SELECT 1 ok" };
      } finally {
        await database.end();
      }
    },
  });
}
