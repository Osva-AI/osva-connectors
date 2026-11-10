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
  const save = vi.fn(async (_body: Buffer, _options: SaveOptions) => {
    void _body;
    void _options;
  });
  const getMetadata = vi.fn(async () => [metadataFixture("1000")] as const);
  const file = vi.fn(() => ({ save, getMetadata }));
  const bucket = vi.fn(() => ({ file }));
  const storage = { bucket } as unknown as Storage;
  return { storage, save, getMetadata, file, bucket };
}

describe("GCS SDK listing calls", () => {
  it("getBuckets uses bounded pagination without unsupported timeout", async () => {
    const getBuckets = vi.fn(
      async (_opts?: {
        maxResults?: number;
        pageToken?: string;
        autoPaginate?: boolean;
        timeout?: number;
      }) => {
        void _opts;
        return [[], { pageToken: "next-buckets" }] as const;
      },
    );
    const storage = { getBuckets } as unknown as Storage;
    const client = createGcsSdkProviderClient({
      projectId: "fixture-project",
      requestTimeoutMs: 5_000,
      storage,
    });
    const page = await client.listBuckets({
      maxResults: 10,
      continuationToken: "tok-1",
    });
    expect(getBuckets).toHaveBeenCalledTimes(1);
    expect(getBuckets).toHaveBeenCalledWith({
      maxResults: 10,
      pageToken: "tok-1",
      autoPaginate: false,
    });
    expect(page.continuationToken).toBe("next-buckets");
  });

  it("getFiles for listObjects maps prefix, limits, and continuation", async () => {
    const getFiles = vi.fn(
      async (_opts?: {
        prefix?: string;
        maxResults?: number;
        pageToken?: string;
        autoPaginate?: boolean;
        versions?: boolean;
        timeout?: number;
      }) => {
        void _opts;
        const file = {
          name: "team/docs/a.txt",
          metadata: {
            size: "3",
            updated: "2020-01-01T00:00:00.000Z",
            etag: '"etag-1"',
          },
        };
        return [[file], {}, { nextPageToken: "obj-next" }] as const;
      },
    );
    const bucket = vi.fn(() => ({ getFiles }));
    const storage = { bucket } as unknown as Storage;
    const client = createGcsSdkProviderClient({
      projectId: "fixture-project",
      requestTimeoutMs: 5_000,
      storage,
    });
    const result = await client.listObjects({
      bucket: "fixtures-bucket",
      prefix: "team/docs/",
      maxKeys: 5,
      continuationToken: "obj-tok",
    });
    expect(bucket).toHaveBeenCalledWith("fixtures-bucket");
    expect(getFiles).toHaveBeenCalledWith({
      prefix: "team/docs/",
      maxResults: 5,
      pageToken: "obj-tok",
      autoPaginate: false,
    });
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0]?.etag).toBe("etag-1");
    expect(result.continuationToken).toBe("obj-next");
  });

  it("getFiles for listObjectVersions sets versions and omits timeout", async () => {
    const getFiles = vi.fn(
      async (_opts?: {
        prefix?: string;
        maxResults?: number;
        pageToken?: string;
        autoPaginate?: boolean;
        versions?: boolean;
        timeout?: number;
      }) => {
        void _opts;
        const file = {
          name: "k",
          generation: 99,
          metadata: {
            size: "1",
            updated: "2020-01-01T00:00:00.000Z",
            etag: '"e"',
          },
        };
        return [[file], {}, { nextPageToken: "ver-next" }] as const;
      },
    );
    const bucket = vi.fn(() => ({ getFiles }));
    const storage = { bucket } as unknown as Storage;
    const client = createGcsSdkProviderClient({
      projectId: "fixture-project",
      requestTimeoutMs: 5_000,
      storage,
    });
    const result = await client.listObjectVersions({
      bucket: "b",
      prefix: "p/",
      maxKeys: 2,
    });
    expect(getFiles).toHaveBeenCalledWith({
      prefix: "p/",
      maxResults: 2,
      pageToken: undefined,
      autoPaginate: false,
      versions: true,
    });
    expect(result.versions[0]?.generation).toBe("99");
    expect(result.continuationToken).toBe("ver-next");
  });
});

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
      timeout: 5_000,
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
