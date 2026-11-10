import type { BlobServiceClient } from "@azure/storage-blob";
import { describe, expect, it, vi } from "vitest";

import { createAzureBlobSdkProviderClient } from "../src/provider-sdk-client.js";

describe("Azure Blob SDK request timeout budget", () => {
  it("listBuckets completes under configured request timeout budget", async () => {
    const byPage = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield {
          containerItems: [{ name: "fixtures" }],
          continuationToken: undefined,
        };
      },
    }));
    const listContainers = vi.fn(() => ({ byPage }));
    const service = {
      listContainers,
    } as unknown as BlobServiceClient;

    const client = createAzureBlobSdkProviderClient({
      accountName: "acct",
      requestTimeoutMs: 2_500,
      service,
    });

    const result = await client.listBuckets({ maxResults: 10 });
    expect(result.buckets).toEqual([{ name: "fixtures" }]);
    expect(byPage).toHaveBeenCalledTimes(1);
    expect(byPage).toHaveBeenCalledWith(
      expect.objectContaining({ maxPageSize: 10 }),
    );
  });

  it("honours a pre-aborted signal on blob download", async () => {
    const controller = new AbortController();
    controller.abort();
    const getProperties = vi.fn(async () => ({
      etag: "e",
      contentLength: 0,
      contentType: "text/plain",
      lastModified: new Date(0),
    }));
    const download = vi.fn();
    const blobClient = vi.fn(() => ({
      getProperties,
      download,
    }));
    const containerClient = vi.fn(() => ({
      getBlobClient: blobClient,
    }));
    const service = {
      getContainerClient: containerClient,
    } as unknown as BlobServiceClient;

    const client = createAzureBlobSdkProviderClient({
      accountName: "acct",
      requestTimeoutMs: 5_000,
      service,
    });

    await expect(
      client.getObject("bucket", "key.txt", {
        maxBytes: 100,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });
});
