import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { EVENT_LIST_SPARSE_FIELDS } from "../src/constants.js";
import { KLAVIYO_EVENT_LIST_TOOL } from "../src/constants.js";
import { createKlaviyoConnector } from "../src/connector.js";
import { mapResourceListResponse } from "../src/normalize-resources.js";
import {
  startMockKlaviyoHttpServer,
  type MockKlaviyoHttpServer,
} from "./fixtures/mock-klaviyo-http-server.js";
import { createTestKlaviyoClient } from "./helpers/test-env.js";

describe("event privacy", () => {
  let server: MockKlaviyoHttpServer | undefined;
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
    await server?.close();
    server = undefined;
  });

  it("requests sparse event fields and omits profile include", async () => {
    server = await startMockKlaviyoHttpServer({ mode: "event_pii" });
    const client = createTestKlaviyoClient(server);
    const connector = createKlaviyoConnector({ client });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "event-privacy", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: KLAVIYO_EVENT_LIST_TOOL,
      arguments: {
        startDatetime: "2024-06-01T00:00:00+00:00",
        endDatetime: "2024-06-02T00:00:00+00:00",
        limit: 5,
      },
    });
    expect(result.isError).not.toBe(true);

    const eventsUrl = server.getLastEventsUrl() ?? "";
    expect(eventsUrl).toContain(
      `fields%5Bevent%5D=${encodeURIComponent(EVENT_LIST_SPARSE_FIELDS)}`,
    );
    expect(eventsUrl.toLowerCase()).not.toContain("include");

    const payload = JSON.stringify(result);
    expect(payload).not.toMatch(/pii@example.com/i);
    expect(payload).not.toContain("event_properties");
    expect(payload).not.toContain("prof_secret");
    expect(payload).not.toContain("phone_number");
  });

  it("strips PII fields when normalizing provider event payloads", () => {
    const normalized = mapResourceListResponse(
      "event",
      {
        data: [
          {
            type: "event",
            id: "evt01",
            attributes: {
              datetime: "2024-06-01T12:00:00+00:00",
              timestamp: 1,
              uuid: "u",
              event_properties: { email: "secret@example.com" },
              profile_id: "prof01",
            },
            relationships: {
              profile: { data: { type: "profile", id: "prof01" } },
            },
          },
        ],
      },
      {},
    );
    const serialized = JSON.stringify(normalized);
    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain("event_properties");
    expect(serialized).not.toContain("relationships");
    expect(serialized).toContain("evt01");
    expect(serialized).toContain("datetime");
  });
});
