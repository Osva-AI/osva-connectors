import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import {
  ConnectorSdkError,
  createMcpServerFromConnector,
} from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { HUBSPOT_CRM_SEARCH_TOOL } from "../src/constants.js";
import { createHubspotConnector } from "../src/connector.js";
import { loadHubspotConfig } from "../src/config.js";
import {
  startMockHubspotHttpServer,
  type MockHubspotHttpServer,
} from "./fixtures/mock-hubspot-http-server.js";
import {
  createTestHubspotClient,
  FAKE_HUBSPOT_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("security regression", () => {
  const clients: Client[] = [];
  let server: MockHubspotHttpServer | undefined;

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
    await server?.close();
    server = undefined;
  });

  async function linkedClient(
    mode?: import("./fixtures/mock-hubspot-http-server.js").MockHubspotMode,
  ) {
    server = await startMockHubspotHttpServer(mode ? { mode } : {});
    const client = createTestHubspotClient(server);
    const connector = createHubspotConnector({
      client,
      accessTokenForRedaction: FAKE_HUBSPOT_ACCESS_TOKEN,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "security-regression", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("rejects missing credentials at config load", () => {
    expect(() => loadHubspotConfig({})).toThrow(ConnectorSdkError);
  });

  it("rejects invalid max rows configuration", () => {
    expect(() =>
      loadHubspotConfig({
        OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN: "pat-test",
        OSVA_CONNECTOR_HUBSPOT_MAX_ROWS: "not-a-number",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects disallowed object types in configuration", () => {
    expect(() =>
      loadHubspotConfig({
        OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN: "pat-test",
        OSVA_CONNECTOR_HUBSPOT_ALLOWED_OBJECT_TYPES: "contacts,invalid",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("strips unexpected contact PII from provider payloads", async () => {
    const { mcpClient } = await linkedClient("contact_pii");
    const result = await mcpClient.callTool({
      name: HUBSPOT_CRM_SEARCH_TOOL,
      arguments: {
        objectType: "contacts",
        filterGroups: [
          {
            filters: [
              {
                propertyName: "lifecyclestage",
                operator: "EQ",
                value: "lead",
              },
            ],
          },
        ],
      },
    });
    expect(result.isError).not.toBe(true);
    const text = JSON.stringify(result);
    expect(text).not.toContain("secret@example.com");
  });

  it("surfaces forbidden scope failures from provider", async () => {
    const { mcpClient } = await linkedClient("forbidden");
    const result = await mcpClient.callTool({
      name: HUBSPOT_CRM_SEARCH_TOOL,
      arguments: {
        objectType: "contacts",
        filterGroups: [
          {
            filters: [
              {
                propertyName: "lifecyclestage",
                operator: "EQ",
                value: "lead",
              },
            ],
          },
        ],
      },
    });
    expect(result.isError).toBe(true);
  });
});
