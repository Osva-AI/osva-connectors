import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadQdrantConfig } from "../src/config.js";
import {
  QDRANT_ALLOW_LOCAL_HTTP_ENV,
  QDRANT_API_KEY_ENV,
  QDRANT_HOST_WRITES_APPROVED_ENV,
  QDRANT_URL_ENV,
  QDRANT_WRITE_ENABLED_ENV,
} from "../src/constants.js";
import { FAKE_QDRANT_API_KEY } from "./fixtures/mock-qdrant-http-server.js";

describe("loadQdrantConfig", () => {
  it("requires Qdrant URL", () => {
    expect(() => loadQdrantConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads HTTPS production config", () => {
    const config = loadQdrantConfig({
      [QDRANT_URL_ENV]: "https://example.cloud.qdrant.io",
      [QDRANT_API_KEY_ENV]: FAKE_QDRANT_API_KEY,
    });
    expect(config.baseUrl).toBe("https://example.cloud.qdrant.io");
    expect(config.allowLocalHttp).toBe(false);
    expect(config.writeEnabled).toBe(false);
    expect(config.hostWritesApproved).toBe(false);
  });

  it("allows local HTTP when explicitly trusted", () => {
    const config = loadQdrantConfig({
      [QDRANT_URL_ENV]: "http://127.0.0.1:6333",
      [QDRANT_ALLOW_LOCAL_HTTP_ENV]: "true",
      [QDRANT_API_KEY_ENV]: FAKE_QDRANT_API_KEY,
    });
    expect(config.baseUrl).toBe("http://127.0.0.1:6333");
    expect(config.allowLocalHttp).toBe(true);
  });

  it("parses write flags", () => {
    const config = loadQdrantConfig({
      [QDRANT_URL_ENV]: "http://localhost:6333",
      [QDRANT_ALLOW_LOCAL_HTTP_ENV]: "true",
      [QDRANT_WRITE_ENABLED_ENV]: "true",
      [QDRANT_HOST_WRITES_APPROVED_ENV]: "yes",
    });
    expect(config.writeEnabled).toBe(true);
    expect(config.hostWritesApproved).toBe(true);
  });
});
