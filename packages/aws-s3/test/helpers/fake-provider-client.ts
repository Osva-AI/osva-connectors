import {
  assertAcceptableContentEncoding,
  precheckDeclaredObjectSize,
  readBoundedByteStream,
} from "../../src/bounded-stream-read.js";
import type {
  S3BucketListResult,
  S3ObjectListResult,
  S3ObjectMetadata,
  S3ObjectReadOptions,
  S3ObjectReadResult,
  S3ObjectVersionsListResult,
  S3ProviderClient,
  S3WriteResult,
} from "../../src/provider-client.js";

export interface StoredObject {
  body: Uint8Array;
  contentType: string;
  etag: string;
  lastModified: string;
  contentEncoding?: string;
  /** When set, head reports this size (may disagree with body/stream). */
  declaredSize?: number;
  streamBody?: () => TrackedByteStream;
}

export type TrackedByteStream = AsyncIterable<Uint8Array> & {
  bytesDelivered: number;
};

export class FakeS3ProviderClient implements S3ProviderClient {
  createCallCount = 0;
  replaceCallCount = 0;
  listObjectsCallCount = 0;
  listObjectVersionsCallCount = 0;
  headObjectCallCount = 0;
  lastListPrefix?: string;
  lastCreateIfNoneMatch?: string;
  lastReplaceIfMatch?: string;
  readonly buckets = new Set<string>(["fixtures-bucket"]);
  readonly objects = new Map<string, StoredObject>();
  bucketTokens = new Map<string, string>();
  objectTokens = new Map<string, string>();

  constructor() {
    const key = "fixtures-bucket/docs/readme.txt";
    this.objects.set(key, {
      body: new TextEncoder().encode("# hello"),
      contentType: "text/markdown",
      etag: "etag-readme-v1",
      lastModified: new Date().toISOString(),
    });
  }

  private tokenKey(bucket: string, prefix: string): string {
    return `${bucket}::${prefix}`;
  }

  async listBuckets(params: {
    continuationToken?: string;
    maxResults: number;
  }): Promise<S3BucketListResult> {
    const names = [...this.buckets].sort();
    const start =
      params.continuationToken === undefined
        ? 0
        : Number(params.continuationToken);
    const slice = names.slice(start, start + params.maxResults);
    const next = start + params.maxResults;
    return {
      buckets: slice.map((name) => ({ name })),
      ...(next < names.length ? { continuationToken: String(next) } : {}),
    };
  }

  async headBucket(bucket: string): Promise<{ region?: string }> {
    if (!this.buckets.has(bucket)) {
      const error = new Error("NotFound");
      error.name = "NoSuchBucket";
      throw error;
    }
    return { region: "us-east-1" };
  }

  async listObjects(params: {
    bucket: string;
    prefix: string;
    maxKeys: number;
    continuationToken?: string;
  }): Promise<S3ObjectListResult> {
    this.listObjectsCallCount += 1;
    this.lastListPrefix = params.prefix;
    const keys = [...this.objects.keys()]
      .filter(
        (key) =>
          key.startsWith(`${params.bucket}/`) &&
          key.slice(params.bucket.length + 1).startsWith(params.prefix),
      )
      .map((key) => key.slice(params.bucket.length + 1))
      .sort();
    const start =
      params.continuationToken === undefined
        ? 0
        : Number(params.continuationToken);
    const page = keys.slice(start, start + params.maxKeys);
    const next = start + params.maxKeys;
    return {
      objects: page.map((key) => {
        const stored = this.objects.get(`${params.bucket}/${key}`);
        return {
          key,
          ...(stored?.body !== undefined
            ? { size: stored.body.byteLength }
            : {}),
          ...(stored?.etag !== undefined ? { etag: stored.etag } : {}),
        };
      }),
      prefix: params.prefix,
      ...(next < keys.length ? { continuationToken: String(next) } : {}),
    };
  }

  async headObject(bucket: string, key: string): Promise<S3ObjectMetadata> {
    this.headObjectCallCount += 1;
    const stored = this.objects.get(`${bucket}/${key}`);
    if (stored === undefined) {
      const error = new Error("missing");
      error.name = "NoSuchKey";
      throw error;
    }
    return {
      bucket,
      key,
      size:
        stored.declaredSize ??
        (stored.streamBody !== undefined ? undefined : stored.body.byteLength),
      etag: stored.etag,
      contentType: stored.contentType,
      lastModified: stored.lastModified,
      ...(stored.contentEncoding !== undefined
        ? { contentEncoding: stored.contentEncoding }
        : {}),
    };
  }

  async getObject(
    bucket: string,
    key: string,
    options: S3ObjectReadOptions,
  ): Promise<S3ObjectReadResult> {
    const metadata = await this.headObject(bucket, key);
    const stored = this.objects.get(`${bucket}/${key}`)!;
    assertAcceptableContentEncoding(metadata.contentEncoding);
    precheckDeclaredObjectSize(metadata.size, options.maxBytes);

    if (stored.streamBody !== undefined) {
      const stream = stored.streamBody();
      const { bytes } = await readBoundedByteStream(
        stream,
        options.maxBytes,
        options.signal,
      );
      return { metadata, body: bytes };
    }

    async function* oneChunk(): AsyncIterable<Uint8Array> {
      yield stored.body;
    }
    const { bytes } = await readBoundedByteStream(
      oneChunk(),
      options.maxBytes,
      options.signal,
    );
    return { metadata, body: bytes };
  }

  setObject(
    bucket: string,
    key: string,
    patch: Partial<StoredObject> &
      Pick<StoredObject, "body" | "contentType" | "etag">,
  ): void {
    const full = `${bucket}/${key}`;
    const existing = this.objects.get(full);
    this.objects.set(full, {
      lastModified: new Date().toISOString(),
      ...existing,
      ...patch,
    } as StoredObject);
  }

  async listObjectVersions(params: {
    bucket: string;
    prefix: string;
    maxKeys: number;
    continuationToken?: string;
  }): Promise<S3ObjectVersionsListResult> {
    this.listObjectVersionsCallCount += 1;
    this.lastListPrefix = params.prefix;
    const keys = [...this.objects.keys()]
      .filter(
        (key) =>
          key.startsWith(`${params.bucket}/`) &&
          key.slice(params.bucket.length + 1).startsWith(params.prefix),
      )
      .map((key) => key.slice(params.bucket.length + 1))
      .sort();
    const start =
      params.continuationToken === undefined
        ? 0
        : Number(params.continuationToken);
    const page = keys.slice(start, start + params.maxKeys);
    const next = start + params.maxKeys;
    return {
      versions: page.map((key) => {
        const stored = this.objects.get(`${params.bucket}/${key}`);
        return {
          key,
          versionId: "null",
          isLatest: true,
          ...(stored?.body !== undefined
            ? { size: stored.body.byteLength }
            : {}),
          ...(stored?.etag !== undefined ? { etag: stored.etag } : {}),
        };
      }),
      prefix: params.prefix,
      ...(next < keys.length ? { continuationToken: String(next) } : {}),
    };
  }

  async createObject(params: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<S3WriteResult> {
    this.createCallCount += 1;
    this.lastCreateIfNoneMatch = "*";
    const full = `${params.bucket}/${params.key}`;
    if (this.objects.has(full)) {
      const error = new Error("exists");
      error.name = "PreconditionFailed";
      throw error;
    }
    const etag = `etag-${Date.now()}`;
    this.objects.set(full, {
      body: params.body,
      contentType: params.contentType,
      etag,
      lastModified: new Date().toISOString(),
    });
    return { bucket: params.bucket, key: params.key, etag };
  }

  async replaceObject(params: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
    expectedETag: string;
  }): Promise<S3WriteResult> {
    this.replaceCallCount += 1;
    this.lastReplaceIfMatch = params.expectedETag;
    const full = `${params.bucket}/${params.key}`;
    const existing = this.objects.get(full);
    if (existing === undefined) {
      const error = new Error("missing");
      error.name = "NoSuchKey";
      throw error;
    }
    if (existing.etag !== params.expectedETag) {
      const error = new Error("etag");
      error.name = "PreconditionFailed";
      throw error;
    }
    const etag = `etag-${Date.now()}`;
    this.objects.set(full, {
      body: params.body,
      contentType: params.contentType,
      etag,
      lastModified: new Date().toISOString(),
    });
    return { bucket: params.bucket, key: params.key, etag };
  }
}
