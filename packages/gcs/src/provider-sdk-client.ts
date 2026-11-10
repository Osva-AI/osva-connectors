import { Storage } from "@google-cloud/storage";

import {
  assertAcceptableContentEncoding,
  precheckDeclaredObjectSize,
  readBoundedByteStream,
} from "./bounded-stream-read.js";
import { MAX_CONTENT_BYTES } from "./constants.js";
import type {
  GcsBucketListResult,
  GcsObjectMetadata,
  GcsObjectReadResult,
  GcsObjectVersionsListResult,
  GcsProviderClient,
  GcsWriteResult,
} from "./provider-client.js";

export interface CreateGcsSdkClientOptions {
  readonly projectId: string;
  readonly requestTimeoutMs: number;
  readonly storage?: Storage;
}

export function createGcsSdkProviderClient(
  options: CreateGcsSdkClientOptions,
): GcsProviderClient {
  const storage =
    options.storage ?? new Storage({ projectId: options.projectId });
  const requestTimeout = options.requestTimeoutMs;

  // List APIs (`getBuckets`, `getFiles`) do not accept per-request `timeout` in
  // @google-cloud/storage v7; listing deadline enforcement remains deferred to
  // the SDK default transport timeout unless a client-level option is added later.

  return {
    async listBuckets(params) {
      const [buckets, nextQuery] = await storage.getBuckets({
        maxResults: params.maxResults,
        pageToken: params.continuationToken,
        autoPaginate: false,
      });
      const result: GcsBucketListResult = {
        buckets: buckets.map((bucket) => ({ name: bucket.name })),
      };
      const token = (nextQuery as { pageToken?: string } | undefined)
        ?.pageToken;
      if (token !== undefined) {
        return { ...result, continuationToken: token };
      }
      return result;
    },

    async headBucket(bucket) {
      const [metadata] = await storage
        .bucket(bucket)
        .getMetadata({ timeout: requestTimeout });
      return { region: metadata.location };
    },

    async listObjects(params) {
      const [files, , response] = await storage.bucket(params.bucket).getFiles({
        prefix: params.prefix || undefined,
        maxResults: params.maxKeys,
        pageToken: params.continuationToken,
        autoPaginate: false,
      });
      const token = (response as { nextPageToken?: string } | undefined)
        ?.nextPageToken;
      return {
        objects: files.map((file) => ({
          key: file.name,
          ...(file.metadata.size ? { size: Number(file.metadata.size) } : {}),
          ...(file.metadata.updated
            ? { lastModified: file.metadata.updated }
            : {}),
          ...(file.metadata.etag
            ? { etag: String(file.metadata.etag).replaceAll('"', "") }
            : {}),
        })),
        prefix: params.prefix,
        ...(token !== undefined ? { continuationToken: token } : {}),
      };
    },

    async headObject(bucket, key) {
      const file = storage.bucket(bucket).file(key);
      const [metadata] = await file.getMetadata({ timeout: requestTimeout });
      return {
        bucket,
        key,
        ...(metadata.size ? { size: Number(metadata.size) } : {}),
        ...(metadata.updated ? { lastModified: metadata.updated } : {}),
        ...(metadata.etag
          ? { etag: String(metadata.etag).replaceAll('"', "") }
          : {}),
        ...(metadata.contentType ? { contentType: metadata.contentType } : {}),
        ...(metadata.contentEncoding
          ? { contentEncoding: String(metadata.contentEncoding) }
          : {}),
        ...(metadata.generation !== undefined
          ? { generation: String(metadata.generation) }
          : {}),
      } satisfies GcsObjectMetadata;
    },

    async getObject(bucket, key, options) {
      const maxBytes = Math.min(options.maxBytes, MAX_CONTENT_BYTES);
      const file = storage.bucket(bucket).file(key);
      const [meta] = await file.getMetadata({ timeout: requestTimeout });
      assertAcceptableContentEncoding(
        meta.contentEncoding ? String(meta.contentEncoding) : undefined,
      );
      const declaredSize = meta.size ? Number(meta.size) : undefined;
      precheckDeclaredObjectSize(declaredSize, maxBytes);
      const metadata = await this.headObject(bucket, key);
      const stream = file.createReadStream({ start: 0, validation: false });
      const { bytes } = await readBoundedByteStream(
        stream as AsyncIterable<Uint8Array>,
        maxBytes,
        options.signal,
      );
      return {
        metadata,
        body: bytes,
      } satisfies GcsObjectReadResult;
    },

    async listObjectVersions(params) {
      const [files, , response] = await storage.bucket(params.bucket).getFiles({
        prefix: params.prefix || undefined,
        maxResults: params.maxKeys,
        pageToken: params.continuationToken,
        autoPaginate: false,
        versions: true,
      });
      const token = (response as { nextPageToken?: string } | undefined)
        ?.nextPageToken;
      const versions = files.map((file) => ({
        key: file.name,
        ...(file.generation !== undefined
          ? { generation: String(file.generation) }
          : {}),
        ...(file.metadata.timeDeleted === undefined
          ? { isLatest: true as const }
          : {}),
        ...(file.metadata.size ? { size: Number(file.metadata.size) } : {}),
        ...(file.metadata.updated
          ? { lastModified: file.metadata.updated }
          : {}),
        ...(file.metadata.etag
          ? { etag: String(file.metadata.etag).replaceAll('"', "") }
          : {}),
      }));
      return {
        versions,
        prefix: params.prefix,
        ...(token !== undefined ? { continuationToken: token } : {}),
      } satisfies GcsObjectVersionsListResult;
    },

    async createObject(params) {
      const file = storage.bucket(params.bucket).file(params.key);
      await file.save(Buffer.from(params.body), {
        contentType: params.contentType,
        preconditionOpts: { ifGenerationMatch: 0 },
        timeout: requestTimeout,
      });
      const metadata = await this.headObject(params.bucket, params.key);
      return {
        bucket: params.bucket,
        key: params.key,
        etag: metadata.etag,
        generation: metadata.generation,
      } satisfies GcsWriteResult;
    },

    async replaceObject(params) {
      const file = storage.bucket(params.bucket).file(params.key);
      await file.save(Buffer.from(params.body), {
        contentType: params.contentType,
        preconditionOpts: {
          ifGenerationMatch: params.expectedGeneration,
        },
        timeout: requestTimeout,
      });
      const metadata = await this.headObject(params.bucket, params.key);
      return {
        bucket: params.bucket,
        key: params.key,
        etag: metadata.etag,
        generation: metadata.generation,
      } satisfies GcsWriteResult;
    },
  };
}
