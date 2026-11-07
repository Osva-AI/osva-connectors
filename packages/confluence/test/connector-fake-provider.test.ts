import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  CONFLUENCE_PAGE_CREATE_TOOL,
  CONFLUENCE_PAGE_UPDATE_TOOL,
  CONFLUENCE_SEARCH_TOOL,
  CONFLUENCE_SPACE_LIST_TOOL,
} from "../src/constants.js";
import { createConfluenceConnector } from "../src/connector.js";
import { confluenceConfigSchema } from "../src/schemas.js";
import {
  FAKE_CONFLUENCE_ACCESS_TOKEN,
  MOCK_PAGE_ID,
  MOCK_SPACE_ID,
  startMockConfluenceHttpServer,
  type MockConfluenceHttpServer,
} from "./fixtures/mock-confluence-http-server.js";
import { createTestConfluenceClient } from "./helpers/test-env.js";

describe("Confluence connector (fake provider)", () => {
  const clients: Client[] = [];
  let server: MockConfluenceHttpServer | undefined;

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

  async function createLinkedClient(options?: {
    readonly writeEnabled?: boolean;
    readonly allowedSpaceIds?: string[];
  }) {
    server = await startMockConfluenceHttpServer();
    const client = createTestConfluenceClient(server);
    const config = confluenceConfigSchema.parse({
      apiBaseV2: server.apiOriginV2,
      apiBaseRest: server.apiOriginRest,
      authorizationHeader: `Bearer ${FAKE_CONFLUENCE_ACCESS_TOKEN}`,
      credentialForRedaction: FAKE_CONFLUENCE_ACCESS_TOKEN,
      writeEnabled: options?.writeEnabled ?? false,
      hostWritesApproved: options?.writeEnabled ?? false,
      ...(options?.allowedSpaceIds !== undefined
        ? { allowedSpaceIds: options.allowedSpaceIds }
        : {}),
    });
    const connector = createConfluenceConnector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  }

  it("lists spaces", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: CONFLUENCE_SPACE_LIST_TOOL,
      arguments: { limit: 10 },
    });
    expect(result.isError).not.toBe(true);
  });

  it("searches with scoped cql when allowlist is set", async () => {
    const mcpClient = await createLinkedClient({
      allowedSpaceIds: [MOCK_SPACE_ID],
    });
    const result = await mcpClient.callTool({
      name: CONFLUENCE_SEARCH_TOOL,
      arguments: { cql: "type=page", limit: 5 },
    });
    expect(result.isError).not.toBe(true);
  });

  it("denies mutations when write flags are off", async () => {
    const mcpClient = await createLinkedClient();
    const result = await mcpClient.callTool({
      name: CONFLUENCE_PAGE_CREATE_TOOL,
      arguments: {
        spaceId: MOCK_SPACE_ID,
        title: "New",
        bodyStorage: "<p>x</p>",
      },
    });
    expect(result.isError).toBe(true);
  });

  it("allows create when writes are enabled", async () => {
    const mcpClient = await createLinkedClient({
      writeEnabled: true,
      allowedSpaceIds: [MOCK_SPACE_ID],
    });
    const result = await mcpClient.callTool({
      name: CONFLUENCE_PAGE_CREATE_TOOL,
      arguments: {
        spaceId: MOCK_SPACE_ID,
        title: "New",
        bodyStorage: "<p>x</p>",
      },
    });
    expect(result.isError).not.toBe(true);
  });

  it("maps version conflict on update", async () => {
    server = await startMockConfluenceHttpServer();
    server.setMode("conflict");
    const client = createTestConfluenceClient(server);
    const config = confluenceConfigSchema.parse({
      apiBaseV2: server.apiOriginV2,
      apiBaseRest: server.apiOriginRest,
      authorizationHeader: `Bearer ${FAKE_CONFLUENCE_ACCESS_TOKEN}`,
      credentialForRedaction: FAKE_CONFLUENCE_ACCESS_TOKEN,
      writeEnabled: true,
      hostWritesApproved: true,
      allowedSpaceIds: [MOCK_SPACE_ID],
    });
    const connector = createConfluenceConnector({ client, config });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: CONFLUENCE_PAGE_UPDATE_TOOL,
      arguments: {
        pageId: MOCK_PAGE_ID,
        versionNumber: 3,
        bodyStorage: "<p>updated</p>",
      },
    });
    expect(result.isError).toBe(true);
    const text = result.content?.[0];
    if (text?.type === "text") {
      expect(text.text.toLowerCase()).toContain("conflict");
    }
  });
});
