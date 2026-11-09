import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertAcceptableContentEncoding,
  precheckDeclaredObjectSize,
  readBoundedByteStream,
} from "./bounded-stream-read.js";
import { MAX_CONTENT_BYTES } from "./constants.js";
import type {
  S3BucketListResult,
  S3ObjectListResult,
  S3ObjectMetadata,
  S3ObjectReadResult,
  S3ProviderClient,
  S3WriteResult,
} from "./provider-client.js";

export interface CreateS3SdkClientOptions {
  readonly region: string;
  readonly requestTimeoutMs: number;
  readonly client?: S3Client;
}

function bodyAsAsyncIterable(
  body: unknown,
): AsyncIterable<Uint8Array> | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (body instanceof Uint8Array) {
    return (async function* () {
      yield body;
    })();
  }
  if (typeof body === "string") {
    return (async function* () {
      yield new TextEncoder().encode(body);
    })();
  }
  return body as AsyncIterable<Uint8Array>;
}

export function createS3SdkProviderClient(
  options: CreateS3SdkClientOptions,
): S3ProviderClient {
  const client = options.client ?? new S3Client({ region: options.region });

  return {
    async listBuckets(params) {
      const response = await client.send(
        new ListBucketsCommand({
          ContinuationToken: params.continuationToken,
          MaxBuckets: params.maxResults,
        }),
      );
      const buckets =
        response.Buckets?.map((bucket) => ({
          name: bucket.Name ?? "",
          ...(bucket.CreationDate !== undefined
            ? { creationDate: bucket.CreationDate.toISOString() }
            : {}),
        })).filter((bucket) => bucket.name.length > 0) ?? [];
      return {
        buckets,
        ...(response.ContinuationToken !== undefined
          ? { continuationToken: response.ContinuationToken }
          : {}),
      } satisfies S3BucketListResult;
    },

    async headBucket(bucket) {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return {};
    },

    async listObjects(params) {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: params.bucket,
          Prefix: params.prefix.length > 0 ? params.prefix : undefined,
          MaxKeys: params.maxKeys,
          ContinuationToken: params.continuationToken,
        }),
      );
      const objects =
        response.Contents?.map((item) => ({
          key: item.Key ?? "",
          ...(item.Size !== undefined ? { size: item.Size } : {}),
          ...(item.LastModified !== undefined
            ? { lastModified: item.LastModified.toISOString() }
            : {}),
          ...(item.ETag !== undefined
            ? { etag: item.ETag.replaceAll('"', "") }
            : {}),
        })).filter((item) => item.key.length > 0) ?? [];
      return {
        objects,
        prefix: params.prefix,
        ...(response.NextContinuationToken !== undefined
          ? { continuationToken: response.NextContinuationToken }
          : {}),
      } satisfies S3ObjectListResult;
    },

    async headObject(bucket, key) {
      const response = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return {
        bucket,
        key,
        ...(response.ContentLength !== undefined
          ? { size: response.ContentLength }
          : {}),
        ...(response.LastModified !== undefined
          ? { lastModified: response.LastModified.toISOString() }
          : {}),
        ...(response.ETag !== undefined
          ? { etag: response.ETag.replaceAll('"', "") }
          : {}),
        ...(response.ContentType !== undefined
          ? { contentType: response.ContentType }
          : {}),
        ...(response.ContentEncoding !== undefined
          ? { contentEncoding: response.ContentEncoding }
          : {}),
      } satisfies S3ObjectMetadata;
    },

    async getObject(bucket, key, options) {
      const maxBytes = Math.min(options.maxBytes, MAX_CONTENT_BYTES);
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { abortSignal: options.signal },
      );
      assertAcceptableContentEncoding(response.ContentEncoding);
      precheckDeclaredObjectSize(response.ContentLength, maxBytes);

      const metadata: S3ObjectMetadata = {
        bucket,
        key,
        ...(response.ContentLength !== undefined
          ? { size: response.ContentLength }
          : {}),
        ...(response.LastModified !== undefined
          ? { lastModified: response.LastModified.toISOString() }
          : {}),
        ...(response.ETag !== undefined
          ? { etag: response.ETag.replaceAll('"', "") }
          : {}),
        ...(response.ContentType !== undefined
          ? { contentType: response.ContentType }
          : {}),
        ...(response.ContentEncoding !== undefined
          ? { contentEncoding: response.ContentEncoding }
          : {}),
      };

      const stream = bodyAsAsyncIterable(response.Body);
      if (stream === undefined) {
        return {
          metadata,
          body: new Uint8Array(),
        } satisfies S3ObjectReadResult;
      }
      try {
        const { bytes } = await readBoundedByteStream(
          stream,
          maxBytes,
          options.signal,
        );
        return { metadata, body: bytes } satisfies S3ObjectReadResult;
      } catch (error) {
        if (error instanceof ConnectorSdkError) {
          throw error;
        }
        throw error;
      }
    },

    async listObjectVersions(params) {
      const response = await client.send(
        new ListObjectVersionsCommand({
          Bucket: params.bucket,
          Prefix: params.prefix.length > 0 ? params.prefix : undefined,
          MaxKeys: params.maxKeys,
          KeyMarker: params.continuationToken,
        }),
      );
      const versions =
        response.Versions?.map((item) => ({
          key: item.Key ?? "",
          ...(item.VersionId !== undefined
            ? { versionId: item.VersionId }
            : {}),
          ...(item.IsLatest !== undefined ? { isLatest: item.IsLatest } : {}),
          ...(item.Size !== undefined ? { size: item.Size } : {}),
          ...(item.LastModified !== undefined
            ? { lastModified: item.LastModified.toISOString() }
            : {}),
          ...(item.ETag !== undefined
            ? { etag: item.ETag.replaceAll('"', "") }
            : {}),
        })).filter((item) => item.key.length > 0) ?? [];
      const deleteMarkers =
        response.DeleteMarkers?.map((item) => ({
          key: item.Key ?? "",
          isDeleteMarker: true as const,
          ...(item.VersionId !== undefined
            ? { versionId: item.VersionId }
            : {}),
          ...(item.IsLatest !== undefined ? { isLatest: item.IsLatest } : {}),
          ...(item.LastModified !== undefined
            ? { lastModified: item.LastModified.toISOString() }
            : {}),
        })).filter((item) => item.key.length > 0) ?? [];
      return {
        versions: [...versions, ...deleteMarkers],
        prefix: params.prefix,
        ...(response.NextKeyMarker !== undefined
          ? { continuationToken: response.NextKeyMarker }
          : {}),
      };
    },

    async createObject(params) {
      const response = await client.send(
        new PutObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
          IfNoneMatch: "*",
        }),
      );
      return {
        bucket: params.bucket,
        key: params.key,
        ...(response.ETag !== undefined
          ? { etag: response.ETag.replaceAll('"', "") }
          : {}),
      } satisfies S3WriteResult;
    },

    async replaceObject(params) {
      const response = await client.send(
        new PutObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
          IfMatch: params.expectedETag,
        }),
      );
      return {
        bucket: params.bucket,
        key: params.key,
        ...(response.ETag !== undefined
          ? { etag: response.ETag.replaceAll('"', "") }
          : {}),
      } satisfies S3WriteResult;
    },
  };
}
