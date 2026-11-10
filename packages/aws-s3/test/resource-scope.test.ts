import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";

import {
  S3_OBJECT_LIST_TOOL,
  S3_OBJECT_METADATA_GET_TOOL,
  S3_OBJECT_TEXT_READ_TOOL,
  S3_OBJECT_VERSIONS_LIST_TOOL,
} from "../src/constants.js";
import { createS3Connector } from "../src/connector.js";
import { ContinuationStore } from "../src/continuation-store.js";
import {
  assertListPrefixAllowed,
  assertObjectKeyAllowed,
  parseBucketScopeMap,
} from "../src/resource-scope.js";
import { FakeS3ProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestS3Config } from "./helpers/test-env.js";

const SCOPE = { b: ["customer-a/"] };

describe("resource scope", () => {
  it("parses JSON map", () => {
    expect(parseBucketScopeMap('{"b":["p/"]}', "test")).toEqual({ b: ["p/"] });
  });

  it("denies unknown keys", () => {
    expect(() => assertObjectKeyAllowed({ b: ["p/"] }, "b", "other/x")).toThrow(
      ConnectorSdkError,
    );
  });

  it("allows exact authorized prefix and descendants", () => {
    expect(() =>
      assertListPrefixAllowed(SCOPE, "b", "customer-a/"),
    ).not.toThrow();
    expect(() =>
      assertListPrefixAllowed(SCOPE, "b", "customer-a/invoices/"),
    ).not.toThrow();
  });

  it("denies sibling, ancestor, and empty prefixes under a narrower scope", () => {
    expect(() => assertListPrefixAllowed(SCOPE, "b", "customer-b/")).toThrow(
      ConnectorSdkError,
    );
    expect(() => assertListPrefixAllowed(SCOPE, "b", "customer-a")).toThrow(
      ConnectorSdkError,
    );
    expect(() => assertListPrefixAllowed(SCOPE, "b", "customer-")).toThrow(
      ConnectorSdkError,
    );
    expect(() => assertListPrefixAllowed(SCOPE, "b", "")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies empty prefix arrays (deny-all, not unrestricted)", () => {
    expect(() => assertListPrefixAllowed({ b: [] }, "b", "docs/")).toThrow(
      ConnectorSdkError,
    );
    expect(() => assertObjectKeyAllowed({ b: [] }, "b", "docs/a")).toThrow(
      ConnectorSdkError,
    );
  });

  it("treats explicit empty-string prefix as whole-bucket scope", () => {
    expect(() => assertListPrefixAllowed({ b: [""] }, "b", "")).not.toThrow();
    expect(() =>
      assertListPrefixAllowed({ b: [""] }, "b", "any/"),
    ).not.toThrow();
    expect(() =>
      assertObjectKeyAllowed({ b: [""] }, "b", "any/key"),
    ).not.toThrow();
  });

  it("does not restrict listing when no allowlist is configured", () => {
    expect(() => assertListPrefixAllowed(undefined, "b", "")).not.toThrow();
  });
});

describe("S3 prefix authorization at the connector boundary", () => {
  async function linked(
    client = new FakeS3ProviderClient(),
    config = defaultTestS3Config({
      allowedBucketsRead: { "fixtures-bucket": ["docs/"] },
    }),
  ) {
    const connector = createS3Connector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "s3-prefix", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, client };
  }

  it("rejects empty and ancestor prefixes with zero provider calls", async () => {
    const { mcpClient, client } = await linked();
    try {
      for (const prefix of ["", "doc"]) {
        const result = await mcpClient.callTool({
          name: S3_OBJECT_LIST_TOOL,
          arguments: { bucket: "fixtures-bucket", prefix },
        });
        expect(result.isError).toBe(true);
        expect(JSON.stringify(result.content)).toMatch(/FORBIDDEN/);
      }
      expect(client.listObjectsCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects sibling prefixes and version listings outside scope", async () => {
    const { mcpClient, client } = await linked();
    try {
      const list = await mcpClient.callTool({
        name: S3_OBJECT_LIST_TOOL,
        arguments: { bucket: "fixtures-bucket", prefix: "images/" },
      });
      const versions = await mcpClient.callTool({
        name: S3_OBJECT_VERSIONS_LIST_TOOL,
        arguments: { bucket: "fixtures-bucket", prefix: "" },
      });
      expect(list.isError).toBe(true);
      expect(versions.isError).toBe(true);
      expect(client.listObjectsCallCount).toBe(0);
      expect(client.listObjectVersionsCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("allows exact and descendant prefixes", async () => {
    const { mcpClient, client } = await linked();
    try {
      const exact = await mcpClient.callTool({
        name: S3_OBJECT_LIST_TOOL,
        arguments: { bucket: "fixtures-bucket", prefix: "docs/" },
      });
      const child = await mcpClient.callTool({
        name: S3_OBJECT_LIST_TOOL,
        arguments: { bucket: "fixtures-bucket", prefix: "docs/readme" },
      });
      expect(exact.isError).not.toBe(true);
      expect(child.isError).not.toBe(true);
      expect(client.listObjectsCallCount).toBe(2);
      expect(client.lastListPrefix).toBe("docs/readme");
    } finally {
      await mcpClient.close();
    }
  });

  it("keeps object reads and metadata inside the authorized prefix", async () => {
    const { mcpClient, client } = await linked();
    try {
      const meta = await mcpClient.callTool({
        name: S3_OBJECT_METADATA_GET_TOOL,
        arguments: { bucket: "fixtures-bucket", key: "docs/readme.txt" },
      });
      const denied = await mcpClient.callTool({
        name: S3_OBJECT_TEXT_READ_TOOL,
        arguments: { bucket: "fixtures-bucket", key: "other/secret.txt" },
      });
      expect(meta.isError).not.toBe(true);
      expect(denied.isError).toBe(true);
      expect(client.headObjectCallCount).toBe(1);
    } finally {
      await mcpClient.close();
    }
  });

  it("does not allow continuation tokens to cross prefix scope", () => {
    const store = new ContinuationStore();
    const token = store.issue(
      {
        connectorKey: "osva-connector-aws-s3",
        family: "object.list",
        bucket: "fixtures-bucket",
        prefix: "docs/",
        pageSize: 20,
      },
      "provider-token",
    );
    expect(() =>
      store.resolve(token, {
        connectorKey: "osva-connector-aws-s3",
        family: "object.list",
        bucket: "fixtures-bucket",
        prefix: "",
        pageSize: 20,
      }),
    ).toThrow(ConnectorSdkError);
  });
});
