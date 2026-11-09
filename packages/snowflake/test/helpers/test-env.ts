import type { SnowflakeConfig } from "../../src/schemas.js";

export function defaultTestSnowflakeConfig(
  overrides: Partial<SnowflakeConfig> = {},
): SnowflakeConfig {
  return {
    account: "xy12345.us-east-1",
    username: "FIXTURE_USER",
    password: "fixture-password",
    role: "FIXTURE_ROLE",
    warehouse: "FIXTURE_WH",
    database: "FIXTURE_DB",
    queryTimeoutSeconds: 30,
    allowedSchemas: ["APP"],
    allowedTables: { APP: ["USERS", "ORDERS"] },
    allowedColumns: {
      APP: {
        USERS: ["ID", "EMAIL", "CREATED_AT"],
        ORDERS: ["ID", "USER_ID", "TOTAL"],
      },
    },
    ...overrides,
  };
}

export function minimalSnowflakeProcessEnv(): NodeJS.ProcessEnv {
  return {
    OSVA_CONNECTOR_SNOWFLAKE_ACCOUNT: "xy12345.us-east-1",
    OSVA_CONNECTOR_SNOWFLAKE_USER: "FIXTURE_USER",
    OSVA_CONNECTOR_SNOWFLAKE_PASSWORD: "fixture-password",
    OSVA_CONNECTOR_SNOWFLAKE_ROLE: "FIXTURE_ROLE",
    OSVA_CONNECTOR_SNOWFLAKE_WAREHOUSE: "FIXTURE_WH",
    OSVA_CONNECTOR_SNOWFLAKE_DATABASE: "FIXTURE_DB",
    OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_SCHEMAS: "APP",
    OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_TABLES: JSON.stringify({
      APP: ["USERS", "ORDERS"],
    }),
    OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_COLUMNS: JSON.stringify({
      APP: {
        USERS: ["ID", "EMAIL", "CREATED_AT"],
        ORDERS: ["ID", "USER_ID", "TOTAL"],
      },
    }),
  };
}
