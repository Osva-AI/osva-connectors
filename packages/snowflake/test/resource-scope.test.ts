import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertTableAllowed,
  parseAllowedTablesEnv,
} from "../src/resource-scope.js";

describe("resource scope (snowflake)", () => {
  it("empty ALLOWED_TABLES fails closed", () => {
    expect(parseAllowedTablesEnv("{}")).toEqual({});
    expect(() => assertTableAllowed("APP", "USERS", {})).toThrow(
      ConnectorSdkError,
    );
  });

  it("parses schema to tables map", () => {
    const map = parseAllowedTablesEnv(JSON.stringify({ APP: ["USERS"] }));
    expect(map).toEqual({ APP: ["USERS"] });
    expect(() => assertTableAllowed("APP", "USERS", map)).not.toThrow();
  });
});
