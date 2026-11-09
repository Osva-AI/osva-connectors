import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { GCS_OBJECT_TEXT_CREATE_TOOL } from "../src/constants.js";
import { createGcsConnector } from "../src/connector.js";
import { FakeGcsProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestGcsConfig } from "./helpers/test-env.js";

describe("GCS mutation safeguards", () => {
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
    overrides?: Parameters<typeof defaultTestGcsConfig>[0],
  ) {
    const connector = createGcsConnector({
      client: new FakeGcsProviderClient(),
      config: defaultTestGcsConfig(overrides),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "s3-mutations", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient.callTool({
      name: GCS_OBJECT_TEXT_CREATE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
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
