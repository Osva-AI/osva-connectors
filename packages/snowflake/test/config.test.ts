import { describe, expect, it } from "vitest";

import { loadSnowflakeConfig } from "../src/config.js";
import { minimalSnowflakeProcessEnv } from "./helpers/test-env.js";

describe("loadSnowflakeConfig", () => {
  it("requires account", () => {
    const env = minimalSnowflakeProcessEnv();
    delete env.OSVA_CONNECTOR_SNOWFLAKE_ACCOUNT;
    expect(() => loadSnowflakeConfig(env)).toThrow(/account/i);
  });

  it("parses allowlists and timeout", () => {
    const config = loadSnowflakeConfig({
      ...minimalSnowflakeProcessEnv(),
      OSVA_CONNECTOR_SNOWFLAKE_QUERY_TIMEOUT_SECONDS: "45",
    });
    expect(config.database).toBe("FIXTURE_DB");
    expect(config.allowedSchemas).toEqual(["APP"]);
    expect(config.queryTimeoutSeconds).toBe(45);
  });

  it("rejects timeout above max", () => {
    expect(() =>
      loadSnowflakeConfig({
        ...minimalSnowflakeProcessEnv(),
        OSVA_CONNECTOR_SNOWFLAKE_QUERY_TIMEOUT_SECONDS: "200",
      }),
    ).toThrow(/out of bounds/i);
  });
});
