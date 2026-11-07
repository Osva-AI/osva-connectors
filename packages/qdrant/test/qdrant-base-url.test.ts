import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { parseQdrantBaseUrl } from "../src/qdrant-base-url.js";

describe("parseQdrantBaseUrl", () => {
  it("accepts production HTTPS", () => {
    expect(parseQdrantBaseUrl("https://cluster.cloud.qdrant.io", false)).toBe(
      "https://cluster.cloud.qdrant.io",
    );
  });

  it("rejects HTTP without trust flag", () => {
    expect(() => parseQdrantBaseUrl("http://127.0.0.1:6333", false)).toThrow(
      ConnectorSdkError,
    );
  });

  it("allows local HTTP with trust flag", () => {
    expect(parseQdrantBaseUrl("http://127.0.0.1:6333", true)).toBe(
      "http://127.0.0.1:6333",
    );
  });

  it("rejects non-loopback HTTP even when local HTTP is trusted", () => {
    expect(() => parseQdrantBaseUrl("http://192.168.1.20:6333", true)).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects private HTTPS hosts", () => {
    expect(() =>
      parseQdrantBaseUrl("https://192.168.1.10:6333", false),
    ).toThrow(ConnectorSdkError);
  });
});
