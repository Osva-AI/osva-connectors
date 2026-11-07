import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadPineconeConfig } from "../src/config.js";
import {
  PINECONE_API_KEY_ENV,
  PINECONE_HOST_WRITES_APPROVED_ENV,
  PINECONE_WRITE_ENABLED_ENV,
} from "../src/constants.js";
import { FAKE_PINECONE_API_KEY } from "./fixtures/mock-pinecone-http-server.js";

describe("loadPineconeConfig", () => {
  it("requires API key", () => {
    expect(() => loadPineconeConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads defaults", () => {
    const config = loadPineconeConfig({
      [PINECONE_API_KEY_ENV]: FAKE_PINECONE_API_KEY,
    });
    expect(config.apiKey).toBe(FAKE_PINECONE_API_KEY);
    expect(config.writeEnabled).toBe(false);
    expect(config.hostWritesApproved).toBe(false);
  });

  it("parses write flags", () => {
    const config = loadPineconeConfig({
      [PINECONE_API_KEY_ENV]: FAKE_PINECONE_API_KEY,
      [PINECONE_WRITE_ENABLED_ENV]: "true",
      [PINECONE_HOST_WRITES_APPROVED_ENV]: "1",
    });
    expect(config.writeEnabled).toBe(true);
    expect(config.hostWritesApproved).toBe(true);
  });
});
