import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  HUBSPOT_ASSOCIATION_LIST_TOOL,
  HUBSPOT_COMPANY_GET_TOOL,
  HUBSPOT_COMPANY_LIST_TOOL,
  HUBSPOT_CONTACT_GET_TOOL,
  HUBSPOT_CONTACT_LIST_TOOL,
  HUBSPOT_CRM_SEARCH_TOOL,
  HUBSPOT_DEAL_GET_TOOL,
  HUBSPOT_DEAL_LIST_TOOL,
  HUBSPOT_OWNER_LIST_TOOL,
  HUBSPOT_PIPELINE_LIST_TOOL,
} from "../src/constants.js";
import { createHubspotConnector } from "../src/connector.js";
import { mapHubspotError } from "../src/map-hubspot-error.js";
import {
  MOCK_COMPANY_ID,
  MOCK_CONTACT_ID,
  MOCK_DEAL_ID,
  startMockHubspotHttpServer,
  type MockHubspotHttpServer,
} from "./fixtures/mock-hubspot-http-server.js";
import {
  createTestHubspotClient,
  FAKE_HUBSPOT_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("HubSpot connector (fake HTTP provider)", () => {
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

  async function createLinkedClient(
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
    const mcpClient = new Client({
      name: "fake-provider-test",
      version: "1.0",
    });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  async function callTool(
    mcpClient: Client,
    name: string,
    arguments_: Record<string, unknown>,
  ) {
    return mcpClient.callTool({ name, arguments: arguments_ });
  }

  it("exercises all ten tools against the fake provider", async () => {
    const { mcpClient, server } = await createLinkedClient();

    const contacts = await callTool(mcpClient, HUBSPOT_CONTACT_LIST_TOOL, {
      limit: 10,
    });
    expect(contacts.isError).not.toBe(true);

    const contact = await callTool(mcpClient, HUBSPOT_CONTACT_GET_TOOL, {
      contactId: MOCK_CONTACT_ID,
    });
    expect(contact.isError).not.toBe(true);

    const companies = await callTool(mcpClient, HUBSPOT_COMPANY_LIST_TOOL, {
      limit: 10,
    });
    expect(companies.isError).not.toBe(true);

    const company = await callTool(mcpClient, HUBSPOT_COMPANY_GET_TOOL, {
      companyId: MOCK_COMPANY_ID,
    });
    expect(company.isError).not.toBe(true);

    const deals = await callTool(mcpClient, HUBSPOT_DEAL_LIST_TOOL, {
      limit: 10,
    });
    expect(deals.isError).not.toBe(true);

    const deal = await callTool(mcpClient, HUBSPOT_DEAL_GET_TOOL, {
      dealId: MOCK_DEAL_ID,
    });
    expect(deal.isError).not.toBe(true);

    const search = await callTool(mcpClient, HUBSPOT_CRM_SEARCH_TOOL, {
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
      limit: 10,
    });
    expect(search.isError).not.toBe(true);

    const searchBody = server.getLastSearchBody() as {
      filterGroups?: unknown;
      properties?: string[];
    };
    expect(Array.isArray(searchBody.filterGroups)).toBe(true);
    expect(searchBody.properties).toContain("lifecyclestage");
    expect(searchBody.properties).not.toContain("email");

    const pipelines = await callTool(mcpClient, HUBSPOT_PIPELINE_LIST_TOOL, {});
    expect(pipelines.isError).not.toBe(true);

    const owners = await callTool(mcpClient, HUBSPOT_OWNER_LIST_TOOL, {
      limit: 10,
    });
    expect(owners.isError).not.toBe(true);

    const associations = await callTool(
      mcpClient,
      HUBSPOT_ASSOCIATION_LIST_TOOL,
      {
        fromObjectType: "contacts",
        fromObjectId: MOCK_CONTACT_ID,
        toObjectType: "companies",
        limit: 10,
      },
    );
    expect(associations.isError).not.toBe(true);

    const listUrl = server.getLastContactListUrl() ?? "";
    expect(listUrl).toContain("properties=");
    expect(listUrl).not.toContain("email");
  });

  it("maps forbidden provider errors", async () => {
    const mapped = mapHubspotError(
      {
        kind: "http",
        status: 403,
        hubspotCategory: "MISSING_SCOPES",
      },
      { accessToken: FAKE_HUBSPOT_ACCESS_TOKEN },
    );
    expect(mapped.code).toBe("FORBIDDEN");
  });

  it("returns MCP errors for invalid search input", async () => {
    const { mcpClient } = await createLinkedClient();
    const invalid = await callTool(mcpClient, HUBSPOT_CRM_SEARCH_TOOL, {
      objectType: "contacts",
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: "test@example.com",
            },
          ],
        },
      ],
    });
    expect(invalid.isError).toBe(true);
  });

  it("rejects malicious pagination links from provider", async () => {
    const { mcpClient } = await createLinkedClient("malicious_paging");
    const result = await callTool(mcpClient, HUBSPOT_CONTACT_LIST_TOOL, {
      limit: 10,
    });
    expect(result.isError).toBe(true);
  });
});
