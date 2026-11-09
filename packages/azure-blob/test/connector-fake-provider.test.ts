import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  AZURE_BLOB_BLOB_METADATA_GET_TOOL,
  AZURE_BLOB_BLOB_TEXT_READ_TOOL,
} from "../src/constants.js";
import { createAzureBlobConnector } from "../src/connector.js";
import { FakeAzureBlobProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestAzureBlobConfig } from "./helpers/test-env.js";

describe("Azure Blob connector fake provider", () => {
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

  async function linkedClient() {
    const connector = createAzureBlobConnector({
      client: new FakeAzureBlobProviderClient(),
      config: defaultTestAzureBlobConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "s3-fake", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("reads fixture object metadata and text", async () => {
    const mcpClient = await linkedClient();
    const meta = await mcpClient.callTool({
      name: AZURE_BLOB_BLOB_METADATA_GET_TOOL,
      arguments: {
        container: "fixtures-container",
        key: "docs/readme.txt",
      },
    });
    expect(meta.isError).not.toBe(true);

    const body = await mcpClient.callTool({
      name: AZURE_BLOB_BLOB_TEXT_READ_TOOL,
      arguments: {
        container: "fixtures-container",
        key: "docs/readme.txt",
      },
    });
    expect(body.isError).not.toBe(true);
    expect(JSON.stringify(body.content)).toContain("hello");
  });
});
