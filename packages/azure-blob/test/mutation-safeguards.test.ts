import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { AZURE_BLOB_BLOB_TEXT_CREATE_TOOL } from "../src/constants.js";
import { createAzureBlobConnector } from "../src/connector.js";
import { FakeAzureBlobProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestAzureBlobConfig } from "./helpers/test-env.js";

describe("Azure Blob mutation safeguards", () => {
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

  async function callCreate(
    overrides?: Parameters<typeof defaultTestAzureBlobConfig>[0],
  ) {
    const connector = createAzureBlobConnector({
      client: new FakeAzureBlobProviderClient(),
      config: defaultTestAzureBlobConfig(overrides),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "s3-mutations", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient.callTool({
      name: AZURE_BLOB_BLOB_TEXT_CREATE_TOOL,
      arguments: {
        container: "fixtures-container",
        key: "docs/new.txt",
        content: "hello",
      },
    });
  }

  it("rejects create when disabled", async () => {
    const result = await callCreate();
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/FORBIDDEN/);
  });

  it("allows create when env gates enabled", async () => {
    const result = await callCreate({
      createEnabled: true,
      hostWritesApproved: true,
    });
    expect(result.isError).not.toBe(true);
  });
});
