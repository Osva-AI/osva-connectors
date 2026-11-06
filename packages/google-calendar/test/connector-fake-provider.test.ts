import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  CAL_CALENDAR_LIST_TOOL,
  CAL_EVENT_CREATE_TOOL,
  CAL_EVENT_LIST_TOOL,
  CAL_FREEBUSY_QUERY_TOOL,
} from "../src/constants.js";
import { createGoogleCalendarConnector } from "../src/connector.js";
import type { GoogleCalendarConfig } from "../src/schemas.js";
import { startMockCalendarHttpServer } from "./fixtures/mock-calendar-http-server.js";
import {
  createTestCalendarClient,
  FAKE_CAL_ACCESS_TOKEN,
} from "./helpers/test-env.js";

describe("Google Calendar connector (fake HTTP provider)", () => {
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

  async function createLinkedClient(config: GoogleCalendarConfig) {
    const server = await startMockCalendarHttpServer();
    const client = createTestCalendarClient(server);
    const connector = createGoogleCalendarConnector({
      client,
      config,
      accessTokenForRedaction: FAKE_CAL_ACCESS_TOKEN,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("calendar.list and event.list", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);

    const cals = await mcpClient.callTool({
      name: CAL_CALENDAR_LIST_TOOL,
      arguments: {},
    });
    expect(cals.isError).not.toBe(true);

    const events = await mcpClient.callTool({
      name: CAL_EVENT_LIST_TOOL,
      arguments: { calendarId: "primary" },
    });
    expect(events.isError).not.toBe(true);

    await server.close();
  });

  it("rejects mutations when write disabled", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);

    const r = await mcpClient.callTool({
      name: "calendar.event.create",
      arguments: {
        calendarId: "primary",
        event: {
          summary: "x",
          start: { dateTime: "2025-01-01T10:00:00Z" },
          end: { dateTime: "2025-01-01T11:00:00Z" },
        },
      },
    });
    expect(r.isError).toBe(true);

    await server.close();
  });

  it("filters calendar.list to allowlisted ids when configured", async () => {
    const cfg: GoogleCalendarConfig = {
      ...readOnlyConfig,
      allowedCalendarIds: ["other@group.calendar.google.com"],
    };
    const { mcpClient, server } = await createLinkedClient(cfg);

    const cals = await mcpClient.callTool({
      name: CAL_CALENDAR_LIST_TOOL,
      arguments: {},
    });
    expect(cals.isError).not.toBe(true);
    expect(cals.structuredContent).toMatchObject({
      calendars: [],
      untrustedContent: true,
    });

    await server.close();
  });

  it("rejects freeBusy when time range is invalid", async () => {
    const { mcpClient, server } = await createLinkedClient(readOnlyConfig);

    const fb = await mcpClient.callTool({
      name: CAL_FREEBUSY_QUERY_TOOL,
      arguments: {
        timeMin: "2025-01-02T00:00:00Z",
        timeMax: "2025-01-01T00:00:00Z",
        items: [{ id: "primary" }],
      },
    });
    expect(fb.isError).toBe(true);

    await server.close();
  });

  it("explicit empty allowlist denies reads (calendar list, event list, free/busy)", async () => {
    const cfg: GoogleCalendarConfig = {
      ...readOnlyConfig,
      allowedCalendarIds: [],
    };
    const { mcpClient, server } = await createLinkedClient(cfg);

    const cals = await mcpClient.callTool({
      name: CAL_CALENDAR_LIST_TOOL,
      arguments: {},
    });
    expect(cals.isError).not.toBe(true);
    expect(cals.structuredContent).toMatchObject({
      calendars: [],
      untrustedContent: true,
    });

    const ev = await mcpClient.callTool({
      name: CAL_EVENT_LIST_TOOL,
      arguments: { calendarId: "primary" },
    });
    expect(ev.isError).toBe(true);

    const fb = await mcpClient.callTool({
      name: CAL_FREEBUSY_QUERY_TOOL,
      arguments: {
        timeMin: "2025-01-01T00:00:00Z",
        timeMax: "2025-01-02T00:00:00Z",
        items: [{ id: "primary" }],
      },
    });
    expect(fb.isError).toBe(true);

    await server.close();
  });

  it("explicit empty allowlist denies mutations when writes are enabled", async () => {
    const cfg: GoogleCalendarConfig = {
      ...readOnlyConfig,
      writeEnabled: true,
      hostMutationsApproved: true,
      allowedCalendarIds: [],
      scopes: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    };
    const { mcpClient, server } = await createLinkedClient(cfg);

    const r = await mcpClient.callTool({
      name: CAL_EVENT_CREATE_TOOL,
      arguments: {
        calendarId: "primary",
        event: {
          summary: "x",
          start: { dateTime: "2025-01-01T10:00:00Z" },
          end: { dateTime: "2025-01-01T11:00:00Z" },
        },
      },
    });
    expect(r.isError).toBe(true);

    await server.close();
  });
});
