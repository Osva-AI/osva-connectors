import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { GRAPH_API_HOST } from "../src/constants.js";
import { createStaticBearerTokenProvider } from "../src/onedrive-auth.js";
import { createOneDriveRestClient } from "../src/onedrive-rest-client.js";
import {
  FAKE_ONEDRIVE_ACCESS_TOKEN,
  MOCK_DRIVE_ID,
  MOCK_TEXT_ITEM_ID,
  MOCK_UPLOAD_PARENT_ID,
  startMockGraphHttpServer,
  type MockGraphHttpServer,
} from "./fixtures/mock-graph-http-server.js";

describe("OneDrive Graph REST client", () => {
  let server: MockGraphHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  function clientFor() {
    if (server === undefined) {
      throw new Error("server not started");
    }
    return createOneDriveRestClient({
      tokenProvider: createStaticBearerTokenProvider(
        FAKE_ONEDRIVE_ACCESS_TOKEN,
      ),
      requestTimeoutMs: 5_000,
      graphApiHost: server.graphApiOrigin,
    });
  }

  it("gets default drive", async () => {
    server = await startMockGraphHttpServer();
    const client = clientFor();
    const raw = await client.getDrive({});
    expect(raw).toMatchObject({ id: MOCK_DRIVE_ID });
    expect(server.getLastAuthorization()).toBe(
      `Bearer ${FAKE_ONEDRIVE_ACCESS_TOKEN}`,
    );
  });

  it("lists root children", async () => {
    server = await startMockGraphHttpServer();
    const client = clientFor();
    const raw = await client.listChildren({ pageSize: 25 });
    expect(raw).toMatchObject({ value: expect.any(Array) });
    expect(server.getLastPathname()).toContain("/me/drive/root/children");
  });

  it("reads item content bytes", async () => {
    server = await startMockGraphHttpServer();
    const client = clientFor();
    const bytes = await client.readItemContent({
      itemId: MOCK_TEXT_ITEM_ID,
      maxBytes: 4096,
    });
    expect(new TextDecoder().decode(bytes)).toContain("Hello OneDrive fixture");
  });

  it("searches drive root", async () => {
    server = await startMockGraphHttpServer();
    const client = clientFor();
    const raw = await client.searchItems({ query: "fixture", pageSize: 10 });
    expect(raw).toMatchObject({ value: expect.any(Array) });
  });

  it("uploads small file", async () => {
    server = await startMockGraphHttpServer();
    const client = clientFor();
    const raw = await client.uploadSmallFile({
      parentItemId: MOCK_UPLOAD_PARENT_ID,
      filename: "hello.txt",
      content: new TextEncoder().encode("upload body"),
    });
    expect(raw).toMatchObject({ name: "hello.txt" });
  });

  it("rejects disallowed production host override", async () => {
    server = await startMockGraphHttpServer();
    const client = createOneDriveRestClient({
      tokenProvider: createStaticBearerTokenProvider(
        FAKE_ONEDRIVE_ACCESS_TOKEN,
      ),
      requestTimeoutMs: 5_000,
      graphApiHost: "https://evil.example/v1.0",
    });
    await expect(client.getDrive({})).rejects.toBeInstanceOf(ConnectorSdkError);
    expect(GRAPH_API_HOST).toContain("graph.microsoft.com");
  });

  it("retries once on 429 when within deadline", async () => {
    server = await startMockGraphHttpServer({ mode: "rate_limit_once" });
    const client = clientFor();
    await client.getDrive({});
    expect(server.getRequestCount()).toBeGreaterThanOrEqual(2);
  });

  it("does not follow redirects with bearer", async () => {
    server = await startMockGraphHttpServer({ mode: "redirect" });
    const client = clientFor();
    await expect(client.getDrive({})).rejects.toBeInstanceOf(ConnectorSdkError);
    expect(server.getRequestCount()).toBe(1);
  });

  it("rejects oversized JSON responses", async () => {
    server = await startMockGraphHttpServer({ mode: "oversized" });
    const client = clientFor();
    await expect(client.getDrive({})).rejects.toBeInstanceOf(ConnectorSdkError);
  });
});
