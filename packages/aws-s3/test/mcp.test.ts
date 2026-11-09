import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  S3_BUCKET_GET_TOOL,
  S3_BUCKET_LIST_TOOL,
  S3_OBJECT_LIST_TOOL,
  S3_OBJECT_METADATA_GET_TOOL,
  S3_OBJECT_TEXT_CREATE_TOOL,
  S3_OBJECT_TEXT_READ_TOOL,
  S3_OBJECT_TEXT_REPLACE_TOOL,
  S3_OBJECT_VERSIONS_LIST_TOOL,
} from "../src/constants.js";
import { createS3Connector } from "../src/connector.js";
import { FakeS3ProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestS3Config } from "./helpers/test-env.js";

const EXPECTED_TOOLS = [
  S3_BUCKET_LIST_TOOL,
  S3_BUCKET_GET_TOOL,
  S3_OBJECT_LIST_TOOL,
  S3_OBJECT_METADATA_GET_TOOL,
  S3_OBJECT_TEXT_READ_TOOL,
  S3_OBJECT_VERSIONS_LIST_TOOL,
  S3_OBJECT_TEXT_CREATE_TOOL,
  S3_OBJECT_TEXT_REPLACE_TOOL,
];

describe("MCP compatibility (aws-s3)", () => {
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
    const connector = createS3Connector({
      client: new FakeS3ProviderClient(),
      config: defaultTestS3Config(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "s3-mcp", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const listed = await mcpClient.listTools({});
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
