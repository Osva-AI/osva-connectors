import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { parseHttpUrl } from "../src/http-url.js";

describe("parseHttpUrl", () => {
  it("accepts https URLs", () => {
    expect(parseHttpUrl("https://example.com/path", "url")).toBe(
      "https://example.com/path",
    );
  });

  it("rejects javascript URLs", () => {
    expect(() => parseHttpUrl("javascript:alert(1)", "url")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects credential embedded URLs", () => {
    expect(() => parseHttpUrl("https://user:pass@example.com/", "url")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects plain http URLs", () => {
    expect(() => parseHttpUrl("http://example.com/", "url")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects loopback and private IPv4 targets", () => {
    expect(() => parseHttpUrl("https://127.0.0.1/", "url")).toThrow(
      ConnectorSdkError,
    );
    expect(() => parseHttpUrl("https://10.0.0.1/", "url")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects metadata hosts", () => {
    expect(() =>
      parseHttpUrl("https://metadata.google.internal/", "url"),
    ).toThrow(ConnectorSdkError);
  });
});
