import type {
  GcsBucketListResult,
  GcsObjectListResult,
  GcsObjectMetadata,
  GcsObjectVersionsListResult,
} from "./provider-client.js";

export function mapBucketListResponse(
  result: GcsBucketListResult,
  continuationToken?: string,
): Record<string, unknown> {
  return {
    buckets: result.buckets,
    ...(continuationToken !== undefined ? { continuationToken } : {}),
  };
}

export function mapObjectListResponse(
  result: GcsObjectListResult,
  continuationToken?: string,
): Record<string, unknown> {
  return {
    objects: result.objects,
    ...(result.prefix !== undefined && result.prefix.length > 0
      ? { prefix: result.prefix }
      : {}),
    ...(continuationToken !== undefined ? { continuationToken } : {}),
  };
}

export function mapObjectMetadataResponse(
  metadata: GcsObjectMetadata,
): Record<string, unknown> {
  return {
    bucket: metadata.bucket,
    key: metadata.key,
    ...(metadata.size !== undefined ? { size: metadata.size } : {}),
    ...(metadata.lastModified !== undefined
      ? { lastModified: metadata.lastModified }
      : {}),
    ...(metadata.etag !== undefined ? { etag: metadata.etag } : {}),
    ...(metadata.contentType !== undefined
      ? { contentType: metadata.contentType }
      : {}),
    ...(metadata.generation !== undefined
      ? { generation: metadata.generation }
      : {}),
  };
}

export function defaultListPageSize(
  limit: number | undefined,
  fallback: number,
): number {
  return limit ?? fallback;
}

export function mapObjectVersionsListResponse(
  result: GcsObjectVersionsListResult,
  continuationToken?: string,
): Record<string, unknown> {
  return {
    versions: result.versions,
    pageInfo: {
      hasMore: continuationToken !== undefined,
      ...(continuationToken !== undefined ? { continuationToken } : {}),
      returnedCount: result.versions.length,
    },
    ...(result.prefix !== undefined && result.prefix.length > 0
      ? { prefix: result.prefix }
      : {}),
  };
}
