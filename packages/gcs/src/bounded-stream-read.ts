import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export function precheckDeclaredObjectSize(
  declaredSize: number | undefined,
  maxBytes: number,
): void {
  if (
    declaredSize !== undefined &&
    Number.isFinite(declaredSize) &&
    declaredSize > maxBytes
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Object content exceeds the connector read size limit.",
    );
  }
}

export function assertAcceptableContentEncoding(
  contentEncoding: string | undefined,
): void {
  if (contentEncoding === undefined || contentEncoding.trim().length === 0) {
    return;
  }
  const normalized = contentEncoding.trim().toLowerCase();
  if (normalized === "identity") {
    return;
  }
  throw new ConnectorSdkError(
    "UNSUPPORTED_FORMAT",
    "Content-Encoding is not supported for text reads.",
  );
}

export interface BoundedStreamReadResult {
  readonly bytes: Uint8Array;
  readonly bytesConsumedFromSource: number;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
}

/**
 * Reads at most maxBytes from source. Probes one byte past the limit to detect
 * overflow without buffering the entire object.
 */
export async function readBoundedByteStream(
  source: AsyncIterable<Uint8Array>,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<BoundedStreamReadResult> {
  throwIfAborted(signal);
  const probeLimit = maxBytes + 1;
  let bytesConsumedFromSource = 0;
  const chunks: Uint8Array[] = [];
  let total = 0;
  let limitExceeded = false;

  const iterator = source[Symbol.asyncIterator]();
  try {
    while (true) {
      throwIfAborted(signal);
      const next = await iterator.next();
      if (next.done) {
        break;
      }
      const chunkBytes =
        next.value instanceof Uint8Array
          ? next.value
          : new Uint8Array(next.value as Buffer);
      bytesConsumedFromSource += chunkBytes.byteLength;
      const remaining = probeLimit - total;
      if (remaining <= 0) {
        limitExceeded = true;
        break;
      }
      if (chunkBytes.byteLength <= remaining) {
        chunks.push(chunkBytes);
        total += chunkBytes.byteLength;
      } else {
        chunks.push(chunkBytes.subarray(0, remaining));
        total += remaining;
        limitExceeded = true;
        break;
      }
      if (total >= probeLimit) {
        limitExceeded = true;
        break;
      }
    }
  } finally {
    if (limitExceeded && typeof iterator.return === "function") {
      try {
        await iterator.return();
      } catch {
        // ignore stream teardown errors
      }
    }
  }

  if (limitExceeded || total > maxBytes) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Object content exceeds the connector read size limit.",
    );
  }

  if (chunks.length === 0) {
    return { bytes: new Uint8Array(0), bytesConsumedFromSource };
  }
  if (chunks.length === 1) {
    return { bytes: chunks[0]!, bytesConsumedFromSource };
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return { bytes: out, bytesConsumedFromSource };
}
