import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { MAX_CONTENT_BYTES } from "../src/constants.js";
import { readBoundedTextObject } from "../src/object-text-read.js";
import {
  assertAcceptableContentEncoding,
  precheckDeclaredObjectSize,
  readBoundedByteStream,
} from "../src/bounded-stream-read.js";
import {
  FakeAzureBlobProviderClient,
  type TrackedByteStream,
} from "./helpers/fake-provider-client.js";

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function trackedChunks(
  parts: Uint8Array[],
  onDeliver?: (n: number) => void,
): TrackedByteStream {
  const state = { bytesDelivered: 0 };
  const iterable = {
    async *[Symbol.asyncIterator]() {
      for (const part of parts) {
        state.bytesDelivered += part.byteLength;
        onDeliver?.(part.byteLength);
        yield part;
      }
    },
    get bytesDelivered() {
      return state.bytesDelivered;
    },
  };
  return iterable as TrackedByteStream;
}

describe("bounded stream read (azure-blob)", () => {
  it("reads a valid small text object", async () => {
    const client = new FakeAzureBlobProviderClient();
    const result = await readBoundedTextObject(
      client,
      "fixtures-container",
      "docs/readme.txt",
    );
    expect(result.text).toContain("hello");
  });

  it("reads an empty object", async () => {
    const client = new FakeAzureBlobProviderClient();
    client.setObject("fixtures-container", "docs/empty.txt", {
      body: new Uint8Array(0),
      contentType: "text/plain",
      etag: "empty",
    });
    const result = await readBoundedTextObject(
      client,
      "fixtures-container",
      "docs/empty.txt",
    );
    expect(result.text).toBe("");
    expect(result.bytesRead).toBe(0);
  });

  it("accepts object exactly at 64 KiB", async () => {
    const client = new FakeAzureBlobProviderClient();
    const body = new Uint8Array(MAX_CONTENT_BYTES).fill(97);
    client.setObject("fixtures-container", "docs/exact.bin", {
      body,
      contentType: "text/plain",
      etag: "exact",
    });
    const result = await readBoundedTextObject(
      client,
      "fixtures-container",
      "docs/exact.bin",
    );
    expect(result.bytesRead).toBe(MAX_CONTENT_BYTES);
  });

  it("rejects object exceeding 64 KiB by one byte", async () => {
    const client = new FakeAzureBlobProviderClient();
    const body = new Uint8Array(MAX_CONTENT_BYTES + 1).fill(97);
    client.setObject("fixtures-container", "docs/over.bin", {
      body,
      contentType: "text/plain",
      etag: "over",
    });
    await expect(
      readBoundedTextObject(client, "fixtures-container", "docs/over.bin"),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("rejects when metadata reports oversized object", async () => {
    const client = new FakeAzureBlobProviderClient();
    client.setObject("fixtures-container", "docs/lie-big.txt", {
      body: utf8Bytes("tiny"),
      contentType: "text/plain",
      etag: "lie",
      declaredSize: MAX_CONTENT_BYTES + 100,
    });
    await expect(
      readBoundedTextObject(client, "fixtures-container", "docs/lie-big.txt"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("streams when metadata understates size", async () => {
    const client = new FakeAzureBlobProviderClient();
    const body = utf8Bytes("streamed-ok");
    client.setObject("fixtures-container", "docs/lie-small.txt", {
      body,
      contentType: "text/plain",
      etag: "lie2",
      declaredSize: 1,
    });
    const result = await readBoundedTextObject(
      client,
      "fixtures-container",
      "docs/lie-small.txt",
    );
    expect(result.text).toBe("streamed-ok");
  });

  it("rejects when metadata size unavailable but stream exceeds limit", async () => {
    const client = new FakeAzureBlobProviderClient();
    const big = new Uint8Array(MAX_CONTENT_BYTES + 50).fill(120);
    client.setObject("fixtures-container", "docs/huge-stream.txt", {
      body: new Uint8Array(0),
      contentType: "text/plain",
      etag: "huge",
      declaredSize: undefined,
      streamBody: () =>
        trackedChunks([big.slice(0, 32_768), big.slice(32_768)]),
    });
    await expect(
      readBoundedTextObject(
        client,
        "fixtures-container",
        "docs/huge-stream.txt",
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("stops oversized streams before consuming the entire body", async () => {
    const chunkSize = 1024;
    const chunks = Array.from({ length: 200 }, () =>
      new Uint8Array(chunkSize).fill(1),
    );
    const stream = trackedChunks(chunks);
    await expect(
      readBoundedByteStream(stream, MAX_CONTENT_BYTES),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
    expect(stream.bytesDelivered).toBeLessThan(chunks.length * chunkSize);
    expect(stream.bytesDelivered).toBeLessThanOrEqual(
      MAX_CONTENT_BYTES + chunkSize,
    );
  });

  it("cancels on aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      readBoundedByteStream(
        trackedChunks([utf8Bytes("x")]),
        MAX_CONTENT_BYTES,
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("rejects invalid UTF-8", async () => {
    const client = new FakeAzureBlobProviderClient();
    client.setObject("fixtures-container", "docs/bad-utf8.txt", {
      body: new Uint8Array([0xff, 0xfe, 0xfd]),
      contentType: "text/plain",
      etag: "bad",
    });
    await expect(
      readBoundedTextObject(client, "fixtures-container", "docs/bad-utf8.txt"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("omits binary MIME content", async () => {
    const client = new FakeAzureBlobProviderClient();
    client.setObject("fixtures-container", "docs/image.bin", {
      body: utf8Bytes("not-used"),
      contentType: "image/png",
      etag: "img",
    });
    const result = await readBoundedTextObject(
      client,
      "fixtures-container",
      "docs/image.bin",
    );
    expect(result.binaryContentOmitted).toBe(true);
    expect(result).not.toHaveProperty("text");
  });

  it("rejects unsupported content encoding", () => {
    expect(() => assertAcceptableContentEncoding("gzip")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects stream failures", async () => {
    const failing = {
      async *[Symbol.asyncIterator]() {
        yield utf8Bytes("partial");
        throw new Error("stream broke");
      },
      bytesDelivered: 0,
    } as TrackedByteStream;
    await expect(
      readBoundedByteStream(failing, MAX_CONTENT_BYTES),
    ).rejects.toThrow("stream broke");
  });

  it("precheck uses declared size only when present", () => {
    expect(() =>
      precheckDeclaredObjectSize(undefined, MAX_CONTENT_BYTES),
    ).not.toThrow();
  });
});
