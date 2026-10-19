import {
  POSTGRES_CONNECT_TIMEOUT_MS_ENV,
  POSTGRES_POOL_MAX_ENV,
  POSTGRES_QUERY_TIMEOUT_MS_ENV,
  POSTGRES_SSL_MODE_ENV,
  POSTGRES_URL_ENV,
} from "../../src/constants.js";

export const TEST_POSTGRES_URL =
  "postgresql://osva_reader:super_secret_pw@db.example.com:5432/analytics";

export function withTestPostgresEnv<T>(
  run: (env: NodeJS.ProcessEnv) => T,
  overrides: Record<string, string | undefined> = {},
): T {
  const env: NodeJS.ProcessEnv = {
    [POSTGRES_URL_ENV]: TEST_POSTGRES_URL,
    [POSTGRES_SSL_MODE_ENV]: "verify",
    ...overrides,
  };
  for (const key of [
    POSTGRES_CONNECT_TIMEOUT_MS_ENV,
    POSTGRES_QUERY_TIMEOUT_MS_ENV,
    POSTGRES_POOL_MAX_ENV,
  ]) {
    if (overrides[key] === undefined) {
      delete env[key];
    }
  }
  return run(env);
}
