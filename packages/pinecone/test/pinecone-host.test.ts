import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { assertPineconeDataHost } from "../src/pinecone-host.js";

describe("assertPineconeDataHost", () => {
  it("accepts pinecone.io hostnames", () => {
    expect(
      assertPineconeDataHost("my-index.svc.us-east-1-aws.pinecone.io"),
    ).toBe("https://my-index.svc.us-east-1-aws.pinecone.io");
  });

  it("rejects arbitrary hosts", () => {
    expect(() => assertPineconeDataHost("evil.example.com")).toThrow(
      ConnectorSdkError,
    );
  });

  it("allows loopback for tests when flagged", () => {
    expect(
      assertPineconeDataHost("127.0.0.1:50811", {
        allowLoopbackForTests: true,
      }),
    ).toBe("http://127.0.0.1:50811");
  });
});
