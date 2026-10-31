import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  NPM_DOWNLOADS_TOOL,
  NPM_PACKAGE_METADATA_TOOL,
} from "../src/constants.js";
import { createNpmConnector } from "../src/connector.js";
import { createNpmClient } from "../src/npm-client.js";
import { createMockNpmFetch } from "./fixtures/mock-npm-fetch.js";

describe("MCP compatibility", () => {
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

  async function createLinkedClient() {
    const client = createNpmClient({ fetch: createMockNpmFetch() });
    const connector = createNpmConnector({ client });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("supports tools/list and tools/call", async () => {
    const mcpClient = await createLinkedClient();
    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual([NPM_PACKAGE_METADATA_TOOL, NPM_DOWNLOADS_TOOL]);

    const metadata = await mcpClient.callTool({
      name: NPM_PACKAGE_METADATA_TOOL,
      arguments: { packageName: "lodash" },
    });
    expect(metadata.isError).not.toBe(true);

    const downloads = await mcpClient.callTool({
      name: NPM_DOWNLOADS_TOOL,
      arguments: { packageName: "lodash", period: "last-month" },
    });
    expect(downloads.isError).not.toBe(true);
  });
});
