import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { parseAllowedSchemasEnv } from "../src/allowed-schemas.js";
import { loadPostgresConfig } from "../src/config.js";
import {
  POSTGRES_ALLOWED_SCHEMAS_ENV,
  POSTGRES_URL_ENV,
} from "../src/constants.js";

describe("allowed schema configuration", () => {
  it("returns undefined when env is unset", () => {
    expect(parseAllowedSchemasEnv(undefined)).toBeUndefined();
  });

  it("rejects empty allowlist strings", () => {
    expect(() => parseAllowedSchemasEnv("  ,  ")).toThrow(ConnectorSdkError);
  });

  it("loads allowlist into postgres config", () => {
    const config = loadPostgresConfig({
      [POSTGRES_URL_ENV]: "postgresql://reader@127.0.0.1:5432/app",
      [POSTGRES_ALLOWED_SCHEMAS_ENV]: "app, analytics",
    });
    expect(config.allowedSchemas).toEqual(["app", "analytics"]);
  });
});
