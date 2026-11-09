import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GCS_OBJECT_TEXT_CREATE_TOOL,
  GCS_OBJECT_TEXT_REPLACE_TOOL,
} from "../src/constants.js";
import { createGcsConnector } from "../src/connector.js";
import { FakeGcsProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestGcsConfig } from "./helpers/test-env.js";

describe("GCS conditional write verification", () => {
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
    client: FakeGcsProviderClient,
    config = defaultTestGcsConfig(),
  ) {
    const connector = createGcsConnector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: "gcs-cond", version: "1.0.0" });
    clients.push(mcp);
    await mcpServer.connect(serverTransport);
    await mcp.connect(clientTransport);
    return mcp;
  }

  it("does not call provider when create disabled", async () => {
    const fake = new FakeGcsProviderClient();
    const mcp = await mcpClient(fake);
    const result = await mcp.callTool({
      name: GCS_OBJECT_TEXT_CREATE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "docs/new.txt",
        content: "hello",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.createCallCount).toBe(0);
  });

  it("records ifGenerationMatch=0 on successful create", async () => {
    const fake = new FakeGcsProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestGcsConfig({ createEnabled: true, hostWritesApproved: true }),
    );
    const result = await mcp.callTool({
      name: GCS_OBJECT_TEXT_CREATE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "docs/brand-new.txt",
        content: "hello",
      },
    });
    expect(result.isError).not.toBe(true);
    expect(fake.createCallCount).toBe(1);
    expect(fake.lastCreateIfGenerationMatch).toBe("0");
  });

  it("rejects stale generation", async () => {
    const fake = new FakeGcsProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestGcsConfig({
        replaceEnabled: true,
        hostWritesApproved: true,
      }),
    );
    const result = await mcp.callTool({
      name: GCS_OBJECT_TEXT_REPLACE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "docs/readme.txt",
        content: "updated",
        expectedGeneration: "99999",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.replaceCallCount).toBe(1);
    expect(fake.lastReplaceIfGenerationMatch).toBe("99999");
  });
});
