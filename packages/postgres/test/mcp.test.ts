import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { POSTGRES_CONNECTION_TEST_TOOL } from "../src/constants.js";
import { createPostgresConnector } from "../src/connector.js";
import { createMockPostgresDatabase } from "./helpers/mock-postgres-database.js";

describe("MCP compatibility", () => {
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

  it("supports tools/list and tools/call for postgres.connection.test", async () => {
    const connector = createPostgresConnector({
      database: createMockPostgresDatabase(),
    });
    const server = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(client);

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools({});
    const toolNames = tools.tools.map((tool) => tool.name);
    expect(toolNames).toEqual([POSTGRES_CONNECTION_TEST_TOOL]);

    const result = await client.callTool({
      name: POSTGRES_CONNECTION_TEST_TOOL,
      arguments: {},
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: true,
      serverVersion: expect.any(String),
    });
  });

  it("returns sanitized errors without stack traces or credentials", async () => {
    const connector = createPostgresConnector({
      database: createMockPostgresDatabase({
        queryError: Object.assign(new Error("28P01 secret"), { code: "28P01" }),
      }),
    });
    const server = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(client);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: POSTGRES_CONNECTION_TEST_TOOL,
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("28P01 secret");
    expect(serialized).not.toMatch(/at .+\(.+\)/);
  });
});
