import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  AZURE_BLOB_CONTAINER_GET_TOOL,
  AZURE_BLOB_CONTAINER_LIST_TOOL,
  AZURE_BLOB_BLOB_LIST_TOOL,
  AZURE_BLOB_BLOB_METADATA_GET_TOOL,
  AZURE_BLOB_BLOB_TEXT_CREATE_TOOL,
  AZURE_BLOB_BLOB_TEXT_READ_TOOL,
  AZURE_BLOB_BLOB_TEXT_REPLACE_TOOL,
  AZURE_BLOB_BLOB_VERSIONS_LIST_TOOL,
} from "../src/constants.js";
import { createAzureBlobConnector } from "../src/connector.js";
import { FakeAzureBlobProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestAzureBlobConfig } from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  AZURE_BLOB_CONTAINER_LIST_TOOL,
  AZURE_BLOB_CONTAINER_GET_TOOL,
  AZURE_BLOB_BLOB_LIST_TOOL,
  AZURE_BLOB_BLOB_METADATA_GET_TOOL,
  AZURE_BLOB_BLOB_TEXT_READ_TOOL,
  AZURE_BLOB_BLOB_VERSIONS_LIST_TOOL,
  AZURE_BLOB_BLOB_TEXT_CREATE_TOOL,
  AZURE_BLOB_BLOB_TEXT_REPLACE_TOOL,
];

describe("MCP compatibility (azure-blob)", () => {
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

  it("exposes exactly eight tools", async () => {
    const connector = createAzureBlobConnector({
      client: new FakeAzureBlobProviderClient(),
      config: defaultTestAzureBlobConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "s3-mcp", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const listed = await mcpClient.listTools({});
    const names = listed.tools.map((tool) => tool.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
