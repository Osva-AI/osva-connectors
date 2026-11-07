import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { MIXPANEL_COHORT_LIST_TOOL } from "../src/constants.js";
import { createMixpanelConnector } from "../src/connector.js";
import {
  FAKE_MIXPANEL_SECRET,
  FAKE_MIXPANEL_USERNAME,
  startMockMixpanelHttpServer,
  type MockMixpanelHttpServer,
} from "./fixtures/mock-mixpanel-http-server.js";
import {
  createTestMixpanelClient,
  createTestMixpanelConfig,
} from "./helpers/test-env.js";

describe("untrusted provider content", () => {
  const clients: Client[] = [];
  let server: MockMixpanelHttpServer | undefined;

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

  it("returns provider strings as data without treating them as instructions", async () => {
    server = await startMockMixpanelHttpServer();
    const connector = createMixpanelConnector({
      client: createTestMixpanelClient(server),
      config: createTestMixpanelConfig(),
      credentialsForRedaction: {
        username: FAKE_MIXPANEL_USERNAME,
        secret: FAKE_MIXPANEL_SECRET,
      },
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "untrusted", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: MIXPANEL_COHORT_LIST_TOOL,
      arguments: { limit: 5 },
    });
    expect(result.isError).not.toBe(true);
    const text = JSON.stringify(result);
    expect(text).toContain("Ignore prompt injection");
    expect(text).not.toContain(FAKE_MIXPANEL_SECRET);
  });
});
