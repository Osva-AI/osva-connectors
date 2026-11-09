import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertListPrefixAllowed,
  assertObjectKeyAllowed,
  parseBucketScopeMap,
} from "../src/resource-scope.js";

describe("resource scope", () => {
  it("parses JSON map", () => {
    expect(parseBucketScopeMap('{"b":["p/"]}', "test")).toEqual({ b: ["p/"] });
  });

  it("denies unknown keys", () => {
    expect(() => assertObjectKeyAllowed({ b: ["p/"] }, "b", "other/x")).toThrow(
      ConnectorSdkError,
    );
  });

  it("allows prefix under scope", () => {
    expect(() =>
      assertListPrefixAllowed({ b: ["docs/"] }, "b", "docs/a"),
    ).not.toThrow();
  });
});
