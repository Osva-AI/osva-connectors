import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  AZURE_BLOB_BLOB_TEXT_CREATE_TOOL,
  AZURE_BLOB_BLOB_TEXT_REPLACE_TOOL,
} from "../src/constants.js";
import { createAzureBlobConnector } from "../src/connector.js";
import { FakeAzureBlobProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestAzureBlobConfig } from "./helpers/test-env.js";

describe("Azure Blob conditional write verification", () => {
  const clients: Client[] = [];

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
  });

  async function mcpClient(
    client: FakeAzureBlobProviderClient,
    config = defaultTestAzureBlobConfig(),
  ) {
    const connector = createAzureBlobConnector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: "azure-cond", version: "1.0.0" });
    clients.push(mcp);
    await mcpServer.connect(serverTransport);
    await mcp.connect(clientTransport);
    return mcp;
  }

  it("does not call provider when create disabled", async () => {
    const fake = new FakeAzureBlobProviderClient();
    const mcp = await mcpClient(fake);
    const result = await mcp.callTool({
      name: AZURE_BLOB_BLOB_TEXT_CREATE_TOOL,
      arguments: {
        container: "fixtures-container",
        key: "docs/new.txt",
        content: "hello",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.createCallCount).toBe(0);
  });

  it("records If-None-Match on successful create", async () => {
    const fake = new FakeAzureBlobProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestAzureBlobConfig({
        createEnabled: true,
        hostWritesApproved: true,
      }),
    );
    const result = await mcp.callTool({
      name: AZURE_BLOB_BLOB_TEXT_CREATE_TOOL,
      arguments: {
        container: "fixtures-container",
        key: "docs/brand-new.txt",
        content: "hello",
      },
    });
    expect(result.isError).not.toBe(true);
    expect(fake.createCallCount).toBe(1);
    expect(fake.lastCreateIfNoneMatch).toBe("*");
  });

  it("rejects stale ETag", async () => {
    const fake = new FakeAzureBlobProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestAzureBlobConfig({
        replaceEnabled: true,
        hostWritesApproved: true,
      }),
    );
    const result = await mcp.callTool({
      name: AZURE_BLOB_BLOB_TEXT_REPLACE_TOOL,
      arguments: {
        container: "fixtures-container",
        key: "docs/readme.txt",
        content: "updated",
        expectedETag: "wrong-etag",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.replaceCallCount).toBe(1);
    expect(fake.lastReplaceIfMatch).toBe("wrong-etag");
  });
});
