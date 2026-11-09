import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GCS_BUCKET_GET_TOOL,
  GCS_BUCKET_LIST_TOOL,
  GCS_OBJECT_LIST_TOOL,
  GCS_OBJECT_METADATA_GET_TOOL,
  GCS_OBJECT_TEXT_CREATE_TOOL,
  GCS_OBJECT_TEXT_READ_TOOL,
  GCS_OBJECT_TEXT_REPLACE_TOOL,
  GCS_OBJECT_VERSIONS_LIST_TOOL,
} from "../src/constants.js";
import { createGcsConnector } from "../src/connector.js";
import { FakeGcsProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestGcsConfig } from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  GCS_BUCKET_LIST_TOOL,
  GCS_BUCKET_GET_TOOL,
  GCS_OBJECT_LIST_TOOL,
  GCS_OBJECT_METADATA_GET_TOOL,
  GCS_OBJECT_TEXT_READ_TOOL,
  GCS_OBJECT_VERSIONS_LIST_TOOL,
  GCS_OBJECT_TEXT_CREATE_TOOL,
  GCS_OBJECT_TEXT_REPLACE_TOOL,
];

describe("MCP compatibility (gcs)", () => {
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
    const connector = createGcsConnector({
      client: new FakeGcsProviderClient(),
      config: defaultTestGcsConfig(),
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
