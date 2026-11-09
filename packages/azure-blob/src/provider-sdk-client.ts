import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

import {
  assertAcceptableContentEncoding,
  precheckDeclaredObjectSize,
  readBoundedByteStream,
} from "./bounded-stream-read.js";
import { MAX_CONTENT_BYTES } from "./constants.js";
import type {
  AzureBlobBucketListResult,
  AzureBlobObjectMetadata,
  AzureBlobObjectReadResult,
  AzureBlobObjectVersionsListResult,
  AzureBlobProviderClient,
  AzureBlobWriteResult,
} from "./provider-client.js";

export interface CreateAzureBlobSdkClientOptions {
  readonly accountName: string;
  readonly requestTimeoutMs: number;
  readonly service?: BlobServiceClient;
}

export function createAzureBlobSdkProviderClient(
  options: CreateAzureBlobSdkClientOptions,
): AzureBlobProviderClient {
  const service =
    options.service ??
    new BlobServiceClient(
      `https://${options.accountName}.blob.core.windows.net`,
      new DefaultAzureCredential(),
    );

  return {
    async listBuckets(params) {
      const buckets: { name: string }[] = [];
      let continuationToken = params.continuationToken;
      for await (const page of service
        .listContainers()
        .byPage({ maxPageSize: params.maxResults, continuationToken })) {
        for (const item of page.containerItems ?? []) {
          buckets.push({ name: item.name });
        }
        continuationToken = page.continuationToken;
        break;
      }
      return {
        buckets,
        ...(continuationToken ? { continuationToken } : {}),
      } satisfies AzureBlobBucketListResult;
    },

    async headBucket(bucket) {
      await service.getContainerClient(bucket).getProperties();
      return {};
    },

    async listObjects(params) {
      const client = service.getContainerClient(params.bucket);
      const objects: Array<{
        key: string;
        size?: number;
        lastModified?: string;
        etag?: string;
      }> = [];
      let continuationToken: string | undefined = params.continuationToken;
      for await (const page of client
        .listBlobsFlat({ prefix: params.prefix || undefined })
        .byPage({ maxPageSize: params.maxKeys, continuationToken })) {
        for (const blob of page.segment.blobItems) {
          objects.push({
            key: blob.name,
            ...(blob.properties.contentLength !== undefined
              ? { size: blob.properties.contentLength }
              : {}),
            ...(blob.properties.lastModified
              ? { lastModified: blob.properties.lastModified.toISOString() }
              : {}),
            ...(blob.properties.etag
              ? { etag: blob.properties.etag.replaceAll('"', "") }
              : {}),
          });
        }
        continuationToken = page.continuationToken;
        break;
      }
      return {
        objects,
        prefix: params.prefix,
        ...(continuationToken ? { continuationToken } : {}),
      };
    },

    async headObject(bucket, key) {
      const blob = service.getContainerClient(bucket).getBlobClient(key);
      const props = await blob.getProperties();
      return {
        bucket,
        key,
        ...(props.contentLength !== undefined
          ? { size: props.contentLength }
          : {}),
        ...(props.lastModified
          ? { lastModified: props.lastModified.toISOString() }
          : {}),
        ...(props.etag ? { etag: props.etag.replaceAll('"', "") } : {}),
        ...(props.contentType ? { contentType: props.contentType } : {}),
        ...(props.contentEncoding
          ? { contentEncoding: props.contentEncoding }
          : {}),
      } satisfies AzureBlobObjectMetadata;
    },

    async getObject(bucket, key, options) {
      const maxBytes = Math.min(options.maxBytes, MAX_CONTENT_BYTES);
      const blob = service.getContainerClient(bucket).getBlobClient(key);
      const download = await blob.download(0, undefined, {
        abortSignal: options.signal,
      });
      assertAcceptableContentEncoding(download.contentEncoding);
      precheckDeclaredObjectSize(download.contentLength, maxBytes);
      const metadata = await this.headObject(bucket, key);
      if (download.readableStreamBody === undefined) {
        return {
          metadata,
          body: new Uint8Array(),
        } satisfies AzureBlobObjectReadResult;
      }
      async function* asChunks(): AsyncIterable<Uint8Array> {
        for await (const chunk of download.readableStreamBody!) {
          yield chunk instanceof Uint8Array
            ? chunk
            : new Uint8Array(Buffer.from(chunk as string));
        }
      }
      const { bytes } = await readBoundedByteStream(
        asChunks(),
        maxBytes,
        options.signal,
      );
      return { metadata, body: bytes } satisfies AzureBlobObjectReadResult;
    },

    async listObjectVersions(params) {
      const client = service.getContainerClient(params.bucket);
      const versions: Array<{
        key: string;
        versionId?: string;
        isLatest?: boolean;
        size?: number;
        lastModified?: string;
        etag?: string;
      }> = [];
      let continuationToken: string | undefined = params.continuationToken;
      for await (const page of client
        .listBlobsFlat({
          prefix: params.prefix || undefined,
          includeVersions: true,
        })
        .byPage({ maxPageSize: params.maxKeys, continuationToken })) {
        for (const blob of page.segment.blobItems) {
          versions.push({
            key: blob.name,
            ...(blob.versionId ? { versionId: blob.versionId } : {}),
            ...(blob.isCurrentVersion !== undefined
              ? { isLatest: blob.isCurrentVersion }
              : {}),
            ...(blob.properties.contentLength !== undefined
              ? { size: blob.properties.contentLength }
              : {}),
            ...(blob.properties.lastModified
              ? { lastModified: blob.properties.lastModified.toISOString() }
              : {}),
            ...(blob.properties.etag
              ? { etag: blob.properties.etag.replaceAll('"', "") }
              : {}),
          });
        }
        continuationToken = page.continuationToken;
        break;
      }
      return {
        versions,
        prefix: params.prefix,
        ...(continuationToken ? { continuationToken } : {}),
      } satisfies AzureBlobObjectVersionsListResult;
    },

    async createObject(params) {
      const blob = service
        .getContainerClient(params.bucket)
        .getBlockBlobClient(params.key);
      await blob.uploadData(Buffer.from(params.body), {
        blobHTTPHeaders: { blobContentType: params.contentType },
        conditions: { ifNoneMatch: "*" },
      });
      const md = await this.headObject(params.bucket, params.key);
      return {
        bucket: params.bucket,
        key: params.key,
        etag: md.etag,
      } satisfies AzureBlobWriteResult;
    },

    async replaceObject(params) {
      const blob = service
        .getContainerClient(params.bucket)
        .getBlockBlobClient(params.key);
      await blob.uploadData(Buffer.from(params.body), {
        blobHTTPHeaders: { blobContentType: params.contentType },
        conditions: { ifMatch: params.expectedETag },
      });
      const md = await this.headObject(params.bucket, params.key);
      return {
        bucket: params.bucket,
        key: params.key,
        etag: md.etag,
      } satisfies AzureBlobWriteResult;
    },
  };
}
