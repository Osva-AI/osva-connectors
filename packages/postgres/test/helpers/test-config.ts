import type { CreatePostgresConnectorOptions } from "../../src/connector.js";
import { DEFAULT_TOTAL_TIMEOUT_MS } from "../../src/constants.js";
import type { PostgresConfig } from "../../src/schemas.js";

export const TEST_QUERY_TIMEOUT_MS = 30_000;
export const TEST_TOTAL_TIMEOUT_MS = DEFAULT_TOTAL_TIMEOUT_MS;

export function samplePostgresConfig(
  overrides: Partial<PostgresConfig> = {},
): PostgresConfig {
  return {
    connectionUrl: "postgresql://reader@127.0.0.1:5432/app",
    sslMode: "disable",
    connectTimeoutMs: 5_000,
    queryTimeoutMs: TEST_QUERY_TIMEOUT_MS,
    totalTimeoutMs: TEST_TOTAL_TIMEOUT_MS,
    poolMax: 2,
    ...overrides,
  };
}

export function defaultConnectorOptions(
  database: CreatePostgresConnectorOptions["database"],
  overrides: Omit<Partial<CreatePostgresConnectorOptions>, "database"> = {},
): CreatePostgresConnectorOptions {
  return {
    database,
    queryTimeoutMs: TEST_QUERY_TIMEOUT_MS,
    totalTimeoutMs: TEST_TOTAL_TIMEOUT_MS,
    ...overrides,
  };
}
