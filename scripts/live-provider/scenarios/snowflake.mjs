import {
  csvHarnessInAllowlist,
  importDistModule,
  runInfrastructureScenarios,
} from "./connector-runner.mjs";

export async function runSnowflakeScenarios(ctx) {
  return runInfrastructureScenarios(ctx, {
    directory: "snowflake",
    loadConfigExport: "loadSnowflakeConfig",
    validateConfig(config) {
      const schemaCount = config.allowedSchemas?.length ?? 0;
      const timeoutOk =
        Number.isInteger(config.queryTimeoutSeconds) &&
        config.queryTimeoutSeconds <= 120;
      return {
        ok: schemaCount > 0 && timeoutOk,
        detail: `database=${config.database}; allowedSchemas=${schemaCount}; queryTimeoutSeconds=${config.queryTimeoutSeconds}`,
      };
    },
    harnessAllowlistCheck() {
      const schema =
        process.env.OSVA_LIVE_PROVIDER_SNOWFLAKE_TEST_SCHEMA?.trim();
      return csvHarnessInAllowlist(
        schema,
        "OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_SCHEMAS",
      );
    },
    async mockPolicyChecks(repoRoot) {
      const scope = await importDistModule(
        repoRoot,
        "snowflake",
        "resource-scope.js",
      );
      try {
        scope.assertSchemaAllowed("OTHER_SCHEMA", ["PUBLIC"]);
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
    async runLiveRead({ timeoutMs }) {
      const mod = await import(
        new URL(
          "../../../packages/snowflake/dist/provider-sdk-client.js",
          import.meta.url,
        ).href
      );
      const configMod = await import(
        new URL("../../../packages/snowflake/dist/config.js", import.meta.url)
          .href
      );
      const config = configMod.loadSnowflakeConfig(process.env);
      const client = mod.createSnowflakeSdkProviderClient({
        account: config.account,
        username: config.username,
        password: config.password,
        role: config.role,
        warehouse: config.warehouse,
        database: config.database,
      });
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(timeoutMs, 45_000),
      );
      try {
        await client.execute({
          sqlText: "SELECT CURRENT_DATABASE() AS db LIMIT 1",
          binds: [],
          timeoutMs: Math.min(config.queryTimeoutSeconds * 1000, 30_000),
          maxRows: 1,
          signal: controller.signal,
        });
        await client.destroy();
        return {
          ok: true,
          detail: "read-only metadata SELECT completed",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
