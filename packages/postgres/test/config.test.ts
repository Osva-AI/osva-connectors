import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadPostgresConfig } from "../src/config.js";
import {
  POSTGRES_CONNECT_TIMEOUT_MS_ENV,
  POSTGRES_POOL_MAX_ENV,
  POSTGRES_QUERY_TIMEOUT_MS_ENV,
  POSTGRES_TOTAL_TIMEOUT_MS_ENV,
  DEFAULT_TOTAL_TIMEOUT_MS,
  POSTGRES_SSL_MODE_ENV,
  POSTGRES_URL_ENV,
} from "../src/constants.js";
import { TEST_POSTGRES_URL, withTestPostgresEnv } from "./helpers/test-env.js";

describe("loadPostgresConfig", () => {
  it("loads a valid configuration from documented environment variables", () => {
    const config = withTestPostgresEnv((env) => loadPostgresConfig(env));
    expect(config.poolMax).toBe(2);
    expect(config.sslMode).toBe("verify");
    expect(config.connectTimeoutMs).toBeGreaterThan(0);
    expect(config.connectionUrl).not.toContain("sslmode=");
  });

  it("rejects missing connection URL", () => {
    expect(() => loadPostgresConfig({})).toThrow(ConnectorSdkError);
    try {
      loadPostgresConfig({});
    } catch (error) {
      expect(error).toMatchObject({ code: "CONFIGURATION_ERROR" });
    }
  });

  it("rejects malformed connection URLs without echoing secrets", () => {
    try {
      loadPostgresConfig({
        [POSTGRES_URL_ENV]: "not-a-valid-url",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorSdkError);
      expect((error as ConnectorSdkError).message).not.toContain(
        "super_secret",
      );
    }
  });

  it("rejects unsupported SSL configuration", () => {
    expect(() =>
      withTestPostgresEnv((env) => loadPostgresConfig(env), {
        [POSTGRES_SSL_MODE_ENV]: "prefer",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("enforces bounded pool settings", () => {
    expect(() =>
      withTestPostgresEnv((env) => loadPostgresConfig(env), {
        [POSTGRES_POOL_MAX_ENV]: "999",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("defaults SSL mode to disable for localhost", () => {
    const config = loadPostgresConfig({
      [POSTGRES_URL_ENV]: "postgresql://reader@127.0.0.1:5432/app",
    });
    expect(config.sslMode).toBe("disable");
  });

  it("defaults total operation deadline when unset", () => {
    const config = withTestPostgresEnv((env) => loadPostgresConfig(env));
    expect(config.totalTimeoutMs).toBe(DEFAULT_TOTAL_TIMEOUT_MS);
  });

  it("rejects total operation deadlines outside bounds", () => {
    expect(() =>
      withTestPostgresEnv((env) => loadPostgresConfig(env), {
        [POSTGRES_TOTAL_TIMEOUT_MS_ENV]: "1000",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("applies explicit timeout and pool overrides within bounds", () => {
    const config = withTestPostgresEnv((env) => loadPostgresConfig(env), {
      [POSTGRES_CONNECT_TIMEOUT_MS_ENV]: "5000",
      [POSTGRES_QUERY_TIMEOUT_MS_ENV]: "15000",
      [POSTGRES_POOL_MAX_ENV]: "4",
    });
    expect(config.connectTimeoutMs).toBe(5000);
    expect(config.queryTimeoutMs).toBe(15000);
    expect(config.poolMax).toBe(4);
  });

  it("never returns the raw secret-bearing URL in thrown messages", () => {
    try {
      withTestPostgresEnv((env) => loadPostgresConfig(env), {
        [POSTGRES_URL_ENV]: TEST_POSTGRES_URL,
        [POSTGRES_POOL_MAX_ENV]: "0",
      });
    } catch (error) {
      expect(String(error)).not.toContain("super_secret_pw");
    }
  });
});
