import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";

import {
  GCS_OBJECT_LIST_TOOL,
  GCS_OBJECT_METADATA_GET_TOOL,
  GCS_OBJECT_TEXT_READ_TOOL,
  GCS_OBJECT_VERSIONS_LIST_TOOL,
} from "../src/constants.js";
import { createGcsConnector } from "../src/connector.js";
import { ContinuationStore } from "../src/continuation-store.js";
import {
  assertListPrefixAllowed,
  assertObjectKeyAllowed,
  parseBucketScopeMap,
} from "../src/resource-scope.js";
import { FakeGcsProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestGcsConfig } from "./helpers/test-env.js";

const SCOPE = { b: ["team/docs/"] };

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
      assertListPrefixAllowed(SCOPE, "b", "team/docs/"),
    ).not.toThrow();
    expect(() =>
      assertListPrefixAllowed(SCOPE, "b", "team/docs/q1/"),
    ).not.toThrow();
  });

  it("denies sibling, ancestor, and empty prefixes under a narrower scope", () => {
    expect(() => assertListPrefixAllowed(SCOPE, "b", "team/images/")).toThrow(
      ConnectorSdkError,
    );
    expect(() => assertListPrefixAllowed(SCOPE, "b", "team/")).toThrow(
      ConnectorSdkError,
    );
    expect(() => assertListPrefixAllowed(SCOPE, "b", "")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies empty prefix arrays", () => {
    expect(() => assertListPrefixAllowed({ b: [] }, "b", "docs/")).toThrow(
      ConnectorSdkError,
    );
  });

  it("treats explicit empty-string prefix as whole-bucket scope", () => {
    expect(() => assertListPrefixAllowed({ b: [""] }, "b", "")).not.toThrow();
  });
});

describe("GCS prefix authorization at the connector boundary", () => {
  async function linked(client = new FakeGcsProviderClient()) {
    const connector = createGcsConnector({
      client,
      config: defaultTestGcsConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "gcs-prefix", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, client };
  }

  it("rejects empty listing prefixes with zero GCS calls", async () => {
    const { mcpClient, client } = await linked();
    try {
      const result = await mcpClient.callTool({
        name: GCS_OBJECT_LIST_TOOL,
        arguments: { bucket: "fixtures-bucket", prefix: "" },
      });
      expect(result.isError).toBe(true);
      expect(client.listObjectsCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("rejects ancestor prefixes and unauthorized version listings", async () => {
    const { mcpClient, client } = await linked();
    try {
      const ancestor = await mcpClient.callTool({
        name: GCS_OBJECT_LIST_TOOL,
        arguments: { bucket: "fixtures-bucket", prefix: "doc" },
      });
      const versions = await mcpClient.callTool({
        name: GCS_OBJECT_VERSIONS_LIST_TOOL,
        arguments: { bucket: "fixtures-bucket", prefix: "" },
      });
      expect(ancestor.isError).toBe(true);
      expect(versions.isError).toBe(true);
      expect(client.listObjectsCallCount).toBe(0);
      expect(client.listObjectVersionsCallCount).toBe(0);
    } finally {
      await mcpClient.close();
    }
  });

  it("allows descendant prefixes and authorized object reads", async () => {
    const { mcpClient, client } = await linked();
    try {
      const listed = await mcpClient.callTool({
        name: GCS_OBJECT_LIST_TOOL,
        arguments: { bucket: "fixtures-bucket", prefix: "docs/" },
      });
      const meta = await mcpClient.callTool({
        name: GCS_OBJECT_METADATA_GET_TOOL,
        arguments: { bucket: "fixtures-bucket", key: "docs/readme.txt" },
      });
      const denied = await mcpClient.callTool({
        name: GCS_OBJECT_TEXT_READ_TOOL,
        arguments: { bucket: "fixtures-bucket", key: "other/secret.txt" },
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

  it("binds GCS continuation tokens to prefix scope", () => {
    const store = new ContinuationStore();
    const token = store.issue(
      {
        connectorKey: "osva-connector-gcs",
        family: "object.list",
        bucket: "fixtures-bucket",
        prefix: "docs/",
        pageSize: 20,
      },
      "gcs-page-token",
    );
    expect(() =>
      store.resolve(token, {
        connectorKey: "osva-connector-gcs",
        family: "object.list",
        bucket: "fixtures-bucket",
        prefix: "other/",
        pageSize: 20,
      }),
    ).toThrow(ConnectorSdkError);
  });
});
