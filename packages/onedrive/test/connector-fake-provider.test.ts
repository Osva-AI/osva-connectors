import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  ONEDRIVE_DRIVE_GET_TOOL,
  ONEDRIVE_FILE_READ_TOOL,
  ONEDRIVE_FILE_SEARCH_TOOL,
  ONEDRIVE_FILE_UPLOAD_SMALL_TOOL,
  ONEDRIVE_ITEM_GET_TOOL,
  ONEDRIVE_ITEM_LIST_TOOL,
} from "../src/constants.js";
import {
  createOneDriveConnector,
  type CreateOneDriveConnectorOptions,
} from "../src/connector.js";
import { mapOneDriveError } from "../src/map-onedrive-error.js";
import {
  MOCK_BINARY_ITEM_ID,
  MOCK_FOLDER_ITEM_ID,
  MOCK_TEXT_ITEM_ID,
  MOCK_UPLOAD_PARENT_ID,
  startMockGraphHttpServer,
  type MockGraphHttpServer,
} from "./fixtures/mock-graph-http-server.js";
import {
  createTestOneDriveClient,
  createTestOneDriveConfig,
  FAKE_ONEDRIVE_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("OneDrive connector (fake Graph provider)", () => {
  const clients: Client[] = [];
  let server: MockGraphHttpServer | undefined;

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
    connectorOptions?: Partial<CreateOneDriveConnectorOptions>,
  ) {
    server = await startMockGraphHttpServer();
    const client = createTestOneDriveClient(server);
    const connector = createOneDriveConnector({
      client,
      config: createTestOneDriveConfig(),
      graphApiHost: server.graphApiOrigin,
      accessTokenForRedaction: FAKE_ONEDRIVE_ACCESS_TOKEN,
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

  it("exercises read tools against the fake provider", async () => {
    const mcpClient = await createLinkedClient();

    const drive = await callTool(mcpClient, ONEDRIVE_DRIVE_GET_TOOL, {});
    expect(drive.isError).not.toBe(true);

    const listed = await callTool(mcpClient, ONEDRIVE_ITEM_LIST_TOOL, {});
    expect(listed.isError).not.toBe(true);

    const got = await callTool(mcpClient, ONEDRIVE_ITEM_GET_TOOL, {
      itemId: MOCK_TEXT_ITEM_ID,
    });
    expect(got.isError).not.toBe(true);

    const read = await callTool(mcpClient, ONEDRIVE_FILE_READ_TOOL, {
      itemId: MOCK_TEXT_ITEM_ID,
    });
    expect(read.isError).not.toBe(true);

    const search = await callTool(mcpClient, ONEDRIVE_FILE_SEARCH_TOOL, {
      query: "fixture",
    });
    expect(search.isError).not.toBe(true);
  });

  it("returns metadata only for binary file read", async () => {
    const mcpClient = await createLinkedClient();
    const read = await callTool(mcpClient, ONEDRIVE_FILE_READ_TOOL, {
      itemId: MOCK_BINARY_ITEM_ID,
    });
    expect(read.isError).not.toBe(true);
  });

  it("rejects upload when writes disabled", async () => {
    const mcpClient = await createLinkedClient();
    const upload = await callTool(mcpClient, ONEDRIVE_FILE_UPLOAD_SMALL_TOOL, {
      parentItemId: MOCK_UPLOAD_PARENT_ID,
      filename: "x.txt",
      contentBase64: Buffer.from("hi").toString("base64"),
    });
    expect(upload.isError).toBe(true);
  });

  it("uploads when writes enabled and host-approved", async () => {
    const mcpClient = await createLinkedClient({
      config: createTestOneDriveConfig({
        writeEnabled: true,
        hostWritesApproved: true,
        allowedUploadFolderIds: [MOCK_UPLOAD_PARENT_ID],
      }),
    });
    const upload = await callTool(mcpClient, ONEDRIVE_FILE_UPLOAD_SMALL_TOOL, {
      parentItemId: MOCK_UPLOAD_PARENT_ID,
      filename: "upload.txt",
      contentBase64: Buffer.from("upload").toString("base64"),
    });
    expect(upload.isError).not.toBe(true);
  });

  it("maps forbidden provider errors", async () => {
    const mapped = mapOneDriveError(
      { kind: "http", status: 403, graphCode: "accessDenied" },
      { accessToken: FAKE_ONEDRIVE_ACCESS_TOKEN },
    );
    expect(mapped.code).toBe("FORBIDDEN");
  });

  it("enforces drive allowlist on direct item access", async () => {
    const mcpClient = await createLinkedClient({
      config: createTestOneDriveConfig({
        allowedDriveIds: ["other_drive_only"],
      }),
    });
    const got = await callTool(mcpClient, ONEDRIVE_ITEM_GET_TOOL, {
      itemId: MOCK_TEXT_ITEM_ID,
    });
    expect(got.isError).toBe(true);
  });

  it("requires folder id for list when root allowlist configured", async () => {
    const mcpClient = await createLinkedClient({
      config: createTestOneDriveConfig({
        allowedRootItemIds: [MOCK_FOLDER_ITEM_ID],
      }),
    });
    const listed = await callTool(mcpClient, ONEDRIVE_ITEM_LIST_TOOL, {});
    expect(listed.isError).toBe(true);
    const ok = await callTool(mcpClient, ONEDRIVE_ITEM_LIST_TOOL, {
      itemId: MOCK_FOLDER_ITEM_ID,
    });
    expect(ok.isError).not.toBe(true);
  });
});
