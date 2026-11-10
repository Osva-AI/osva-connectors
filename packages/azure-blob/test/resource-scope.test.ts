import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";

import {
  AZURE_BLOB_BLOB_LIST_TOOL,
  AZURE_BLOB_BLOB_METADATA_GET_TOOL,
  AZURE_BLOB_BLOB_TEXT_READ_TOOL,
  AZURE_BLOB_BLOB_VERSIONS_LIST_TOOL,
} from "../src/constants.js";
import { createAzureBlobConnector } from "../src/connector.js";
import { ContinuationStore } from "../src/continuation-store.js";
import {
  assertBlobKeyAllowed,
  assertListPrefixAllowed,
  parseContainerScopeMap,
} from "../src/resource-scope.js";
import { FakeAzureBlobProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestAzureBlobConfig } from "./helpers/test-env.js";

const SCOPE = { invoices: ["customer-a/"] };

describe("resource scope", () => {
  it("parses JSON map", () => {
    expect(parseContainerScopeMap('{"b":["p/"]}', "test")).toEqual({
      b: ["p/"],
    });
  });

  it("denies unknown keys", () => {
    expect(() => assertBlobKeyAllowed({ b: ["p/"] }, "b", "other/x")).toThrow(
      ConnectorSdkError,
    );
  });

  it("allows exact authorized prefix and descendants", () => {
    expect(() =>
      assertListPrefixAllowed(SCOPE, "invoices", "customer-a/"),
    ).not.toThrow();
    expect(() =>
      assertListPrefixAllowed(SCOPE, "invoices", "customer-a/2024/"),
    ).not.toThrow();
  });

  it("denies sibling, ancestor, and empty prefixes under a narrower container scope", () => {
    expect(() =>
      assertListPrefixAllowed(SCOPE, "invoices", "customer-b/"),
    ).toThrow(ConnectorSdkError);
    expect(() =>
      assertListPrefixAllowed(SCOPE, "invoices", "customer-"),
    ).toThrow(ConnectorSdkError);
    expect(() => assertListPrefixAllowed(SCOPE, "invoices", "")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies empty prefix arrays for a container", () => {
    expect(() =>
      assertListPrefixAllowed({ invoices: [] }, "invoices", "a/"),
    ).toThrow(ConnectorSdkError);
  });

  it("treats explicit empty-string prefix as whole-container scope", () => {
    expect(() =>
      assertListPrefixAllowed({ invoices: [""] }, "invoices", ""),
    ).not.toThrow();
  });
});

describe("Azure Blob prefix authorization at the connector boundary", () => {
  async function linked(client = new FakeAzureBlobProviderClient()) {
    const connector = createAzureBlobConnector({
      client,
      config: defaultTestAzureBlobConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "azure-prefix", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, client };
  }

  it("rejects empty listing prefixes with zero Azure adapter calls", async () => {
    const { mcpClient, client } = await linked();
    try {
      const result = await mcpClient.callTool({
        name: AZURE_BLOB_BLOB_LIST_TOOL,
        arguments: { container: "fixtures-container", prefix: "" },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/FORBIDDEN/);
      expect(client.listObjectsCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects ancestor prefixes and unauthorized version listings", async () => {
    const { mcpClient, client } = await linked();
    try {
      const ancestor = await mcpClient.callTool({
        name: AZURE_BLOB_BLOB_LIST_TOOL,
        arguments: { container: "fixtures-container", prefix: "doc" },
      });
      const versions = await mcpClient.callTool({
        name: AZURE_BLOB_BLOB_VERSIONS_LIST_TOOL,
        arguments: { container: "fixtures-container", prefix: "" },
      });
      expect(ancestor.isError).toBe(true);
      expect(versions.isError).toBe(true);
      expect(client.listObjectsCallCount).toBe(0);
      expect(client.listObjectVersionsCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("allows descendant prefixes and authorized blob reads", async () => {
    const { mcpClient, client } = await linked();
    try {
      const listed = await mcpClient.callTool({
        name: AZURE_BLOB_BLOB_LIST_TOOL,
        arguments: { container: "fixtures-container", prefix: "docs/" },
      });
      const meta = await mcpClient.callTool({
        name: AZURE_BLOB_BLOB_METADATA_GET_TOOL,
        arguments: { container: "fixtures-container", key: "docs/readme.txt" },
      });
      const denied = await mcpClient.callTool({
        name: AZURE_BLOB_BLOB_TEXT_READ_TOOL,
        arguments: { container: "fixtures-container", key: "other/secret.txt" },
      });
      expect(listed.isError).not.toBe(true);
      expect(meta.isError).not.toBe(true);
      expect(denied.isError).toBe(true);
      expect(client.listObjectsCallCount).toBe(1);
      expect(client.lastListPrefix).toBe("docs/");
    } finally {
      await mcpClient.close();
    }
  });

  it("binds Azure continuation tokens to container and prefix", () => {
    const store = new ContinuationStore();
    const token = store.issue(
      {
        connectorKey: "osva-connector-azure-blob",
        family: "object.list",
        bucket: "fixtures-container",
        prefix: "docs/",
        pageSize: 20,
      },
      "azure-marker",
    );
    expect(() =>
      store.resolve(token, {
        connectorKey: "osva-connector-azure-blob",
        family: "object.list",
        bucket: "other-container",
        prefix: "docs/",
        pageSize: 20,
      }),
    ).toThrow(ConnectorSdkError);
  });
});
