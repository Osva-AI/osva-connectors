import type { SupabaseConfig } from "../../src/schemas.js";
import { makeSupabaseJwt } from "./jwt-fixture.js";

export function defaultTestSupabaseConfig(
  overrides: Partial<SupabaseConfig> = {},
): SupabaseConfig {
  const anon = makeSupabaseJwt("anon");
  return {
    projectUrl: "http://127.0.0.1:54321",
    pinnedOrigin: "http://127.0.0.1:54321",
    restBaseUrl: "http://127.0.0.1:54321/rest/v1",
    projectRef: "local",
    publishableKey: anon,
    userAccessToken: anon,
    allowTestApiHost: true,
    allowedSchemas: ["public"],
    allowedTables: {
      public: {
        users: {
          columns: ["id", "email", "name"],
          lookupColumn: "id",
        },
      },
    },
    requestTimeoutMs: 5_000,
    countExactEnabled: true,
    ...overrides,
  };
}
