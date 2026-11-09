import type { AzureBlobProviderClient } from "./provider-client.js";
import { MAX_CONTENT_BYTES } from "./constants.js";
import {
  assertAcceptableContentEncoding,
  precheckDeclaredObjectSize,
} from "./bounded-stream-read.js";
import { decodeUtf8Content, isAllowedMimeType } from "./content-policy.js";
import { mapObjectMetadataResponse } from "./normalize-object.js";

export async function readBoundedTextObject(
  client: AzureBlobProviderClient,
  bucket: string,
  key: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const head = await client.headObject(bucket, key);
  assertAcceptableContentEncoding(head.contentEncoding);
  precheckDeclaredObjectSize(head.size, MAX_CONTENT_BYTES);

  const mime = head.contentType ?? "application/octet-stream";
  if (!isAllowedMimeType(mime)) {
    return {
      ...mapObjectMetadataResponse(head),
      binaryContentOmitted: true as const,
      untrustedContent: true as const,
    };
  }

  const { metadata, body } = await client.getObject(bucket, key, {
    maxBytes: MAX_CONTENT_BYTES,
    signal,
  });
  const text = decodeUtf8Content(body);
  return {
    ...mapObjectMetadataResponse(metadata),
    text,
    bytesRead: body.byteLength,
    untrustedContent: true as const,
  };
}
