import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { validateUserHttpsUrl } from "../src/url-validation.js";

describe("validateUserHttpsUrl", () => {
  it("accepts public HTTPS URLs", () => {
    expect(validateUserHttpsUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("rejects non-HTTPS", () => {
    expect(() => validateUserHttpsUrl("http://example.com")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects loopback hosts", () => {
    expect(() => validateUserHttpsUrl("https://127.0.0.1/")).toThrow(
      ConnectorSdkError,
    );
    expect(() => validateUserHttpsUrl("https://localhost/")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects private IPv4 ranges", () => {
    expect(() => validateUserHttpsUrl("https://10.0.0.1/")).toThrow(
      ConnectorSdkError,
    );
    expect(() => validateUserHttpsUrl("https://192.168.1.1/")).toThrow(
      ConnectorSdkError,
    );
    expect(() => validateUserHttpsUrl("https://172.16.0.1/")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects metadata hosts", () => {
    expect(() =>
      validateUserHttpsUrl("https://metadata.google.internal/"),
    ).toThrow(ConnectorSdkError);
  });
});
