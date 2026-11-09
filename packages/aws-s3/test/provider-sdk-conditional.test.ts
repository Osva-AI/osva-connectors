import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { createS3SdkProviderClient } from "../src/provider-sdk-client.js";

describe("S3 SDK conditional headers", () => {
  it("sends IfNoneMatch * on create", async () => {
    const send = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      const input = (command as PutObjectCommand).input;
      expect(input.IfNoneMatch).toBe("*");
      return { ETag: '"new"' };
    });
    const client = createS3SdkProviderClient({
      region: "us-east-1",
      requestTimeoutMs: 5_000,
      client: { send } as unknown as S3Client,
    });
    await client.createObject({
      bucket: "b",
      key: "k",
      body: new TextEncoder().encode("x"),
      contentType: "text/plain",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends IfMatch expected ETag on replace", async () => {
    const send = vi.fn(async (command: unknown) => {
      const input = (command as PutObjectCommand).input;
      expect(input.IfMatch).toBe("etag-1");
      return { ETag: '"new"' };
    });
    const client = createS3SdkProviderClient({
      region: "us-east-1",
      requestTimeoutMs: 5_000,
      client: { send } as unknown as S3Client,
    });
    await client.replaceObject({
      bucket: "b",
      key: "k",
      body: new TextEncoder().encode("y"),
      contentType: "text/plain",
      expectedETag: "etag-1",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
