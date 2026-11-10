import {
  assertAcceptableContentEncoding,
  precheckDeclaredObjectSize,
  readBoundedByteStream,
} from "../../src/bounded-stream-read.js";
import type {
  AzureBlobBucketListResult,
  AzureBlobObjectListResult,
  AzureBlobObjectMetadata,
  AzureBlobObjectReadOptions,
  AzureBlobObjectReadResult,
  AzureBlobObjectVersionsListResult,
  AzureBlobProviderClient,
  AzureBlobWriteResult,
} from "../../src/provider-client.js";

export interface StoredObject {
  body: Uint8Array;
  contentType: string;
  etag: string;
  lastModified: string;
  contentEncoding?: string;
  declaredSize?: number;
  streamBody?: () => TrackedByteStream;
}

export type TrackedByteStream = AsyncIterable<Uint8Array> & {
  bytesDelivered: number;
};

export class FakeAzureBlobProviderClient implements AzureBlobProviderClient {
  createCallCount = 0;
  replaceCallCount = 0;
  listObjectsCallCount = 0;
  listObjectVersionsCallCount = 0;
  headObjectCallCount = 0;
  lastListPrefix?: string;
  lastCreateIfNoneMatch?: string;
  lastReplaceIfMatch?: string;
  readonly buckets = new Set<string>(["fixtures-container"]);
  readonly objects = new Map<string, StoredObject>();
  bucketTokens = new Map<string, string>();
  objectTokens = new Map<string, string>();

  constructor() {
    const key = "fixtures-container/docs/readme.txt";
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
  }): Promise<AzureBlobBucketListResult> {
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
  }): Promise<AzureBlobObjectListResult> {
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

  async headObject(
    bucket: string,
    key: string,
  ): Promise<AzureBlobObjectMetadata> {
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
    options: AzureBlobObjectReadOptions,
  ): Promise<AzureBlobObjectReadResult> {
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
  }): Promise<AzureBlobObjectVersionsListResult> {
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
  }): Promise<AzureBlobWriteResult> {
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
  }): Promise<AzureBlobWriteResult> {
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
