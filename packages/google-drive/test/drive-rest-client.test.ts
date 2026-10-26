import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { DRIVE_API_HOST } from "../src/constants.js";
import { createStaticBearerTokenProvider } from "../src/drive-auth.js";
import { createDriveRestClient } from "../src/drive-rest-client.js";
import {
  FAKE_DRIVE_ACCESS_TOKEN,
  MOCK_DRIVE_ID,
  MOCK_TEXT_FILE_ID,
  startMockDriveHttpServer,
  type MockDriveHttpServer,
} from "./fixtures/mock-drive-http-server.js";

describe("Drive REST client", () => {
  let server: MockDriveHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  function clientFor() {
    if (server === undefined) {
      throw new Error("server not started");
    }
    return createDriveRestClient({
      tokenProvider: createStaticBearerTokenProvider(FAKE_DRIVE_ACCESS_TOKEN),
      requestTimeoutMs: 5_000,
      driveApiHost: server.driveApiOrigin,
    });
  }

  it("lists files with shared drive parameters", async () => {
    server = await startMockDriveHttpServer();
    const client = clientFor();
    await client.listFiles({
      pageSize: 50,
      driveId: MOCK_DRIVE_ID,
      includeSharedDrives: true,
    });
    const query = server.getLastFilesListQuery();
    expect(query?.get("supportsAllDrives")).toBe("true");
    expect(query?.get("driveId")).toBe(MOCK_DRIVE_ID);
    expect(server.getLastAuthorization()).toBe(
      `Bearer ${FAKE_DRIVE_ACCESS_TOKEN}`,
    );
  });

  it("reads file media bytes", async () => {
    server = await startMockDriveHttpServer();
    const client = clientFor();
    const bytes = await client.readFileMedia({
      fileId: MOCK_TEXT_FILE_ID,
      maxBytes: 4096,
    });
    expect(new TextDecoder().decode(bytes)).toContain("Hello fixture");
  });

  it("rejects disallowed production host override", async () => {
    server = await startMockDriveHttpServer();
    const client = createDriveRestClient({
      tokenProvider: createStaticBearerTokenProvider(FAKE_DRIVE_ACCESS_TOKEN),
      requestTimeoutMs: 5_000,
      driveApiHost: "https://evil.example/drive/v3",
    });
    await expect(client.listFiles({ pageSize: 10 })).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
    expect(DRIVE_API_HOST).toContain("googleapis.com");
  });

  it("retries once on 429 when within deadline", async () => {
    server = await startMockDriveHttpServer({ mode: "rate_limit_once" });
    const client = clientFor();
    const raw = await client.listFiles({ pageSize: 10 });
    expect(raw).toMatchObject({ files: expect.any(Array) });
    expect(server.getRequestCount()).toBeGreaterThanOrEqual(2);
  });

  it("rejects oversized JSON responses", async () => {
    server = await startMockDriveHttpServer({ mode: "oversized" });
    const client = clientFor();
    await expect(client.listFiles({ pageSize: 10 })).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
  });
});
