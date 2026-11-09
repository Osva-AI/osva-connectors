import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  S3_OBJECT_TEXT_CREATE_TOOL,
  S3_OBJECT_TEXT_REPLACE_TOOL,
} from "../src/constants.js";
import { createS3Connector } from "../src/connector.js";
import { FakeS3ProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestS3Config } from "./helpers/test-env.js";

describe("S3 conditional write verification", () => {
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
    client: FakeS3ProviderClient,
    config = defaultTestS3Config(),
  ) {
    const connector = createS3Connector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: "s3-cond", version: "1.0.0" });
    clients.push(mcp);
    await mcpServer.connect(serverTransport);
    await mcp.connect(clientTransport);
    return mcp;
  }

  it("does not call provider when create disabled", async () => {
    const fake = new FakeS3ProviderClient();
    const mcp = await mcpClient(fake);
    const result = await mcp.callTool({
      name: S3_OBJECT_TEXT_CREATE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "docs/new.txt",
        content: "hello",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.createCallCount).toBe(0);
  });

  it("does not call provider without host approval", async () => {
    const fake = new FakeS3ProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestS3Config({ createEnabled: true }),
    );
    const result = await mcp.callTool({
      name: S3_OBJECT_TEXT_CREATE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "docs/new.txt",
        content: "hello",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.createCallCount).toBe(0);
  });

  it("records If-None-Match on successful create", async () => {
    const fake = new FakeS3ProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestS3Config({ createEnabled: true, hostWritesApproved: true }),
    );
    const result = await mcp.callTool({
      name: S3_OBJECT_TEXT_CREATE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "docs/brand-new.txt",
        content: "hello",
      },
    });
    expect(result.isError).not.toBe(true);
    expect(fake.createCallCount).toBe(1);
    expect(fake.lastCreateIfNoneMatch).toBe("*");
  });

  it("rejects replace without expectedETag in schema", async () => {
    const fake = new FakeS3ProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestS3Config({
        replaceEnabled: true,
        hostWritesApproved: true,
      }),
    );
    const result = await mcp.callTool({
      name: S3_OBJECT_TEXT_REPLACE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "docs/readme.txt",
        content: "updated",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.replaceCallCount).toBe(0);
  });

  it("rejects stale ETag without provider replace", async () => {
    const fake = new FakeS3ProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestS3Config({
        replaceEnabled: true,
        hostWritesApproved: true,
      }),
    );
    const result = await mcp.callTool({
      name: S3_OBJECT_TEXT_REPLACE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "docs/readme.txt",
        content: "updated",
        expectedETag: "wrong-etag",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.replaceCallCount).toBe(1);
    expect(fake.lastReplaceIfMatch).toBe("wrong-etag");
  });

  it("denies unauthorized prefix before provider write", async () => {
    const fake = new FakeS3ProviderClient();
    const mcp = await mcpClient(
      fake,
      defaultTestS3Config({ createEnabled: true, hostWritesApproved: true }),
    );
    const result = await mcp.callTool({
      name: S3_OBJECT_TEXT_CREATE_TOOL,
      arguments: {
        bucket: "fixtures-bucket",
        key: "secret/no.txt",
        content: "nope",
      },
    });
    expect(result.isError).toBe(true);
    expect(fake.createCallCount).toBe(0);
  });
});
