import type {
  S3BucketListResult,
  S3ObjectListResult,
  S3ObjectMetadata,
  S3ObjectVersionsListResult,
} from "./provider-client.js";

export function mapBucketListResponse(
  result: S3BucketListResult,
  continuationToken?: string,
): Record<string, unknown> {
  return {
    buckets: result.buckets,
    ...(continuationToken !== undefined ? { continuationToken } : {}),
  };
}

export function mapObjectListResponse(
  result: S3ObjectListResult,
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
  metadata: S3ObjectMetadata,
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
  };
}

export function defaultListPageSize(
  limit: number | undefined,
  fallback: number,
): number {
  return limit ?? fallback;
}

export function mapObjectVersionsListResponse(
  result: S3ObjectVersionsListResult,
  continuationToken?: string,
): Record<string, unknown> {
  const versions = result.versions.filter((v) => v.isDeleteMarker !== true);
  return {
    versions,
    pageInfo: {
      hasMore: continuationToken !== undefined,
      ...(continuationToken !== undefined ? { continuationToken } : {}),
      returnedCount: versions.length,
    },
    ...(result.prefix !== undefined && result.prefix.length > 0
      ? { prefix: result.prefix }
      : {}),
  };
}
