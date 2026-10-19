import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  normalizePropertyIdInput,
  parsePropertyId,
} from "../src/property-id.js";

describe("property id validation", () => {
  it("accepts numeric ids and properties/ prefix", () => {
    expect(parsePropertyId("123456789")).toBe("123456789");
    expect(normalizePropertyIdInput("properties/987654321")).toBe("987654321");
  });

  it("rejects invalid ids", () => {
    expect(() => parsePropertyId("abc")).toThrow(ConnectorSdkError);
    expect(() => parsePropertyId("")).toThrow(ConnectorSdkError);
  });
});
