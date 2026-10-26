import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { normalizeCustomerIdInput } from "../src/customer-id.js";

describe("customer ID validation", () => {
  it("accepts canonical 10-digit ids", () => {
    expect(normalizeCustomerIdInput("123-456-7890")).toBe("1234567890");
  });

  it("rejects invalid ids", () => {
    expect(() => normalizeCustomerIdInput("123")).toThrow(ConnectorSdkError);
  });
});
