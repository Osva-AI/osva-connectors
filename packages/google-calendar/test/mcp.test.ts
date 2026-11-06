import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  CAL_CALENDAR_LIST_TOOL,
  CAL_FREEBUSY_QUERY_TOOL,
} from "../src/constants.js";
import { createGoogleCalendarConnector } from "../src/connector.js";
import type { GoogleCalendarConfig } from "../src/schemas.js";
import { startMockCalendarHttpServer } from "./fixtures/mock-calendar-http-server.js";
import { createTestCalendarClient } from "./helpers/test-env.js";

describe("MCP compatibility (google-calendar)", () => {
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

  const readOnlyConfig: GoogleCalendarConfig = {
    requestTimeoutMs: 5_000,
    useDomainDelegation: false,
    writeEnabled: false,
    hostMutationsApproved: false,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  };

  it("supports tools/list", async () => {
    const server = await startMockCalendarHttpServer();
    const client = createTestCalendarClient(server);
    const connector = createGoogleCalendarConnector({
      client,
      config: readOnlyConfig,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const tools = await mcpClient.listTools({});
    const names = tools.tools.map((t) => t.name);
    expect(names.length).toBe(7);
    expect(names).toContain(CAL_CALENDAR_LIST_TOOL);

    const fb = await mcpClient.callTool({
      name: CAL_FREEBUSY_QUERY_TOOL,
      arguments: {
        timeMin: "2025-01-01T00:00:00Z",
        timeMax: "2025-01-02T00:00:00Z",
        items: [{ id: "primary" }],
      },
    });
    expect(fb.isError).not.toBe(true);

    await server.close();
  });
});
