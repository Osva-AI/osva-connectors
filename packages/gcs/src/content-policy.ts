import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_CONTENT_BYTES } from "./constants.js";

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/x-ndjson",
]);

export function assertAllowedMimeType(mimeType: string): void {
  const normalized = mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME.has(normalized)) {
    throw new ConnectorSdkError(
      "UNSUPPORTED_FORMAT",
      "Object MIME type is not on the connector allowlist.",
    );
  }
}

export function decodeUtf8Content(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_CONTENT_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Object content exceeds the connector read size limit.",
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ConnectorSdkError(
      "UNSUPPORTED_FORMAT",
      "Object content is not valid UTF-8 text.",
    );
  }
}

export function encodeWriteContent(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Write content is empty.");
  }
  if (bytes.byteLength > MAX_CONTENT_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Write content exceeds the connector size limit.",
    );
  }
  return bytes;
}

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME.has(mimeType.trim().toLowerCase());
}

export const ALLOWED_MIME_TYPES = [...ALLOWED_MIME] as const;
