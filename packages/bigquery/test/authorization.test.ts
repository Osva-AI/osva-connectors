import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { createBigqueryConnector } from "../src/connector.js";
import {
  assertDatasetAllowed,
  assertTableAllowed,
} from "../src/resource-scope.js";
import { FakeBigQueryProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestBigqueryConfig } from "./helpers/test-env.js";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";

import { BIGQUERY_TABLE_GET_TOOL } from "../src/constants.js";

describe("authorization", () => {
  it("denies empty dataset allowlist", () => {
    expect(() => assertDatasetAllowed([], "analytics")).toThrow(
      ConnectorSdkError,
    );
  });

  it("denies tables outside allowlist", () => {
    expect(() =>
      assertTableAllowed({ analytics: { events: [] } }, "analytics", "secrets"),
    ).toThrow(ConnectorSdkError);
  });

  it("connector rejects disallowed table access", async () => {
    const connector = createBigqueryConnector({
      client: new FakeBigQueryProviderClient(),
      config: defaultTestBigqueryConfig(),
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "bq-auth", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    try {
      const result = await mcpClient.callTool({
        name: BIGQUERY_TABLE_GET_TOOL,
        arguments: { datasetId: "analytics", tableId: "secrets" },
      });
      expect(result.isError).toBe(true);
    } finally {
      await mcpClient.close();
    }
  });
});
