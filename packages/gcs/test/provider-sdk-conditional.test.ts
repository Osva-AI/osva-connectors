import type { Storage } from "@google-cloud/storage";
import { describe, expect, it, vi } from "vitest";

import { createGcsSdkProviderClient } from "../src/provider-sdk-client.js";

function metadataFixture(generation: string) {
  return {
    size: "2",
    etag: "etag-fixture",
    generation,
    contentType: "text/plain; charset=utf-8",
    updated: new Date(0).toISOString(),
  };
}

type SaveOptions = {
  contentType: string;
  preconditionOpts: { ifGenerationMatch: number | string };
};

function createMockStorage() {
  const save = vi.fn(async (_body: Buffer, _options: SaveOptions) => undefined);
  const getMetadata = vi.fn(async () => [metadataFixture("1000")] as const);
  const file = vi.fn(() => ({ save, getMetadata }));
  const bucket = vi.fn(() => ({ file }));
  const storage = { bucket } as unknown as Storage;
  return { storage, save, getMetadata, file, bucket };
}

describe("GCS SDK conditional writes", () => {
  it("create passes ifGenerationMatch=0", async () => {
    const { storage, save } = createMockStorage();
    const client = createGcsSdkProviderClient({
      projectId: "fixture-project",
      requestTimeoutMs: 5_000,
      storage,
    });
    await client.createObject({
      bucket: "fixtures-bucket",
      key: "docs/new.txt",
      body: new TextEncoder().encode("hello"),
      contentType: "text/plain; charset=utf-8",
    });
    expect(save).toHaveBeenCalledTimes(1);
    const options = save.mock.calls[0]![1];
    expect(options).toEqual({
      contentType: "text/plain; charset=utf-8",
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  });

  it("replace passes the exact expected generation string", async () => {
    const largeGeneration = "9223372036854775807";
    const { storage, save, getMetadata } = createMockStorage();
    getMetadata.mockResolvedValue([metadataFixture(largeGeneration)] as const);
    const client = createGcsSdkProviderClient({
      projectId: "fixture-project",
      requestTimeoutMs: 5_000,
      storage,
    });
    await client.replaceObject({
      bucket: "fixtures-bucket",
      key: "docs/readme.txt",
      body: new TextEncoder().encode("updated"),
      contentType: "text/plain; charset=utf-8",
      expectedGeneration: largeGeneration,
    });
    expect(save).toHaveBeenCalledTimes(1);
    const options = save.mock.calls[0]![1];
    expect(options.preconditionOpts.ifGenerationMatch).toBe(largeGeneration);
    expect(typeof options.preconditionOpts.ifGenerationMatch).toBe("string");
  });

  it("does not use unconditional create semantics on replace", async () => {
    const { storage, save } = createMockStorage();
    const client = createGcsSdkProviderClient({
      projectId: "fixture-project",
      requestTimeoutMs: 5_000,
      storage,
    });
    await client.replaceObject({
      bucket: "b",
      key: "k",
      body: new TextEncoder().encode("x"),
      contentType: "text/plain",
      expectedGeneration: "42",
    });
    const options = save.mock.calls[0]![1];
    expect(options.preconditionOpts).toEqual({ ifGenerationMatch: "42" });
    expect(options.preconditionOpts.ifGenerationMatch).not.toBe(0);
  });
});
