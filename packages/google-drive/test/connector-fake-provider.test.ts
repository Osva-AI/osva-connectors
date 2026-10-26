import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  DRIVE_CHANGES_LIST_TOOL,
  DRIVE_CHANGES_START_TOOL,
  DRIVE_FILE_EXPORT_TOOL,
  DRIVE_FILE_GET_TOOL,
  DRIVE_FILE_LIST_TOOL,
  DRIVE_FILE_READ_TOOL,
  DRIVE_FOLDER_LIST_TOOL,
  DRIVE_SHARED_DRIVE_LIST_TOOL,
} from "../src/constants.js";
import {
  createGoogleDriveConnector,
  type CreateGoogleDriveConnectorOptions,
} from "../src/connector.js";
import { mapDriveError } from "../src/map-drive-error.js";
import {
  MOCK_DOC_FILE_ID,
  MOCK_DRIVE_ID,
  MOCK_FOLDER_ID,
  MOCK_TEXT_FILE_ID,
  startMockDriveHttpServer,
  type MockDriveHttpServer,
} from "./fixtures/mock-drive-http-server.js";
import {
  createTestDriveClient,
  FAKE_DRIVE_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("Google Drive connector (fake HTTP provider)", () => {
  const clients: Client[] = [];
  let server: MockDriveHttpServer | undefined;

  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map(async (client) => {
        try {
          await client.close();
        } catch {
          // ignore
        }
      }),
    );
    await server?.close();
    server = undefined;
  });

  async function createLinkedClient(
    connectorOptions?: Partial<CreateGoogleDriveConnectorOptions>,
  ) {
    server = await startMockDriveHttpServer();
    const client = createTestDriveClient(server);
    const connector = createGoogleDriveConnector({
      client,
      maxContentBytes: 262_144,
      accessTokenForRedaction: FAKE_DRIVE_ACCESS_TOKEN,
      ...connectorOptions,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({
      name: "fake-provider-test",
      version: "1.0",
    });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  async function callTool(
    mcpClient: Client,
    name: string,
    arguments_: Record<string, unknown>,
  ) {
    return mcpClient.callTool({ name, arguments: arguments_ });
  }

  it("exercises all eight tools against the fake provider", async () => {
    const mcpClient = await createLinkedClient();

    const listed = await callTool(mcpClient, DRIVE_FILE_LIST_TOOL, {
      driveId: MOCK_DRIVE_ID,
      includeSharedDrives: true,
    });
    expect(listed.isError).not.toBe(true);

    const got = await callTool(mcpClient, DRIVE_FILE_GET_TOOL, {
      fileId: MOCK_TEXT_FILE_ID,
    });
    expect(got.isError).not.toBe(true);

    const read = await callTool(mcpClient, DRIVE_FILE_READ_TOOL, {
      fileId: MOCK_TEXT_FILE_ID,
    });
    expect(read.isError).not.toBe(true);

    const exported = await callTool(mcpClient, DRIVE_FILE_EXPORT_TOOL, {
      fileId: MOCK_DOC_FILE_ID,
      format: "text/plain",
    });
    expect(exported.isError).not.toBe(true);

    const folder = await callTool(mcpClient, DRIVE_FOLDER_LIST_TOOL, {
      folderId: MOCK_FOLDER_ID,
      driveId: MOCK_DRIVE_ID,
    });
    expect(folder.isError).not.toBe(true);

    const drives = await callTool(mcpClient, DRIVE_SHARED_DRIVE_LIST_TOOL, {});
    expect(drives.isError).not.toBe(true);

    const start = await callTool(mcpClient, DRIVE_CHANGES_START_TOOL, {
      driveId: MOCK_DRIVE_ID,
    });
    expect(start.isError).not.toBe(true);

    const changes = await callTool(mcpClient, DRIVE_CHANGES_LIST_TOOL, {
      pageToken: "fixture_token",
      driveId: MOCK_DRIVE_ID,
    });
    expect(changes.isError).not.toBe(true);
  });

  it("rejects binary export formats", async () => {
    const mcpClient = await createLinkedClient();
    const pdf = await callTool(mcpClient, DRIVE_FILE_EXPORT_TOOL, {
      fileId: MOCK_DOC_FILE_ID,
      format: "application/pdf",
    });
    expect(pdf.isError).toBe(true);
  });

  it("rejects workspace files on drive.file.read", async () => {
    const mcpClient = await createLinkedClient();
    const read = await callTool(mcpClient, DRIVE_FILE_READ_TOOL, {
      fileId: MOCK_DOC_FILE_ID,
    });
    expect(read.isError).toBe(true);
  });

  it("maps forbidden provider errors", async () => {
    const mapped = mapDriveError(
      { kind: "http", status: 403, googleStatus: "PERMISSION_DENIED" },
      { accessToken: FAKE_DRIVE_ACCESS_TOKEN },
    );
    expect(mapped.code).toBe("FORBIDDEN");
  });

  it("enforces drive allowlist on direct file access", async () => {
    const mcpClient = await createLinkedClient({
      allowedDriveIds: ["other_drive_only"],
    });
    const got = await callTool(mcpClient, DRIVE_FILE_GET_TOOL, {
      fileId: MOCK_TEXT_FILE_ID,
    });
    expect(got.isError).toBe(true);
  });
});
