import type { BlobServiceClient } from "@azure/storage-blob";
import { describe, expect, it, vi } from "vitest";

import { createAzureBlobSdkProviderClient } from "../src/provider-sdk-client.js";

type UploadOptions = {
  blobHTTPHeaders: { blobContentType: string };
  conditions: { ifNoneMatch?: string; ifMatch?: string };
};

function propertiesFixture() {
  return {
    etag: "etag-1",
    contentLength: 3,
    contentType: "text/plain; charset=utf-8",
    lastModified: new Date(0),
  };
}

function createMockService() {
  const uploadData = vi.fn(
    async (_data: Buffer, _options: UploadOptions) => undefined,
  );
  const getProperties = vi.fn(async () => propertiesFixture());
  const blockBlobClient = vi.fn(() => ({ uploadData }));
  const blobClient = vi.fn(() => ({ getProperties }));
  const containerClient = vi.fn(() => ({
    getBlockBlobClient: blockBlobClient,
    getBlobClient: blobClient,
  }));
  const service = {
    getContainerClient: containerClient,
  } as unknown as BlobServiceClient;
  return {
    service,
    uploadData,
    getProperties,
    blockBlobClient,
    containerClient,
  };
}

describe("Azure Blob SDK conditional writes", () => {
  it("create passes If-None-Match *", async () => {
    const { service, uploadData } = createMockService();
    const client = createAzureBlobSdkProviderClient({
      accountName: "fixtures",
      requestTimeoutMs: 5_000,
      service,
    });
    await client.createObject({
      bucket: "fixtures-container",
      key: "docs/new.txt",
      body: new TextEncoder().encode("hello"),
      contentType: "text/plain; charset=utf-8",
    });
    expect(uploadData).toHaveBeenCalledTimes(1);
    const options = uploadData.mock.calls[0]![1];
    expect(options.conditions).toEqual({ ifNoneMatch: "*" });
  });

  it("replace passes If-Match with expected ETag", async () => {
    const { service, uploadData } = createMockService();
    const client = createAzureBlobSdkProviderClient({
      accountName: "fixtures",
      requestTimeoutMs: 5_000,
      service,
    });
    await client.replaceObject({
      bucket: "fixtures-container",
      key: "docs/readme.txt",
      body: new TextEncoder().encode("updated"),
      contentType: "text/plain; charset=utf-8",
      expectedETag: "etag-1",
    });
    expect(uploadData).toHaveBeenCalledTimes(1);
    const options = uploadData.mock.calls[0]![1];
    expect(options.conditions).toEqual({ ifMatch: "etag-1" });
  });

  it("includes explicit conditions on every upload (no unconditional path)", async () => {
    const { service, uploadData } = createMockService();
    const client = createAzureBlobSdkProviderClient({
      accountName: "fixtures",
      requestTimeoutMs: 5_000,
      service,
    });
    await client.createObject({
      bucket: "c",
      key: "k",
      body: new TextEncoder().encode("a"),
      contentType: "text/plain",
    });
    await client.replaceObject({
      bucket: "c",
      key: "k",
      body: new TextEncoder().encode("b"),
      contentType: "text/plain",
      expectedETag: "etag-1",
    });
    for (const call of uploadData.mock.calls) {
      const options = call[1]!;
      expect(options.conditions).toBeDefined();
      expect(
        options.conditions.ifNoneMatch ?? options.conditions.ifMatch,
      ).toBeDefined();
    }
  });
});
