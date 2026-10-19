import { describe, expect, it } from "vitest";

import { createPostgresPoolConfig } from "../src/postgres-client.js";
import type { PostgresConfig } from "../src/schemas.js";

describe("createPostgresPoolConfig", () => {
  it("uses bounded pool and timeout settings", () => {
    const config: PostgresConfig = {
      connectionUrl:
        "postgresql://reader:secret@db.example.com:5432/app?sslmode=disable",
      sslMode: "verify",
      connectTimeoutMs: 8_000,
      queryTimeoutMs: 12_000,
      totalTimeoutMs: 45_000,
      poolMax: 3,
    };
    const poolConfig = createPostgresPoolConfig(config);
    expect(poolConfig.max).toBe(3);
    expect(poolConfig.connectionTimeoutMillis).toBe(8_000);
    expect(poolConfig.statement_timeout).toBe(12_000);
    expect(poolConfig.ssl).toEqual({ rejectUnauthorized: true });
    expect(String(poolConfig.connectionString)).not.toContain("sslmode=");
  });
});
