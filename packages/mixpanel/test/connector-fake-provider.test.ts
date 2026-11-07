import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import {
  ConnectorSdkError,
  createMcpServerFromConnector,
} from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  MIXPANEL_COHORT_LIST_TOOL,
  MIXPANEL_FUNNEL_GET_TOOL,
  MIXPANEL_REPORT_GET_TOOL,
  MIXPANEL_RETENTION_RUN_TOOL,
  MIXPANEL_SEGMENTATION_RUN_TOOL,
} from "../src/constants.js";
import { createMixpanelConnector } from "../src/connector.js";
import { mapMixpanelError } from "../src/map-mixpanel-error.js";
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

describe("Mixpanel connector (fake HTTP provider)", () => {
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

  async function createLinkedClient(
    configOverrides?: Partial<ReturnType<typeof createTestMixpanelConfig>>,
  ) {
    server = await startMockMixpanelHttpServer();
    const client = createTestMixpanelClient(server);
    const connector = createMixpanelConnector({
      client,
      config: { ...createTestMixpanelConfig(), ...configOverrides },
      credentialsForRedaction: {
        username: FAKE_MIXPANEL_USERNAME,
        secret: FAKE_MIXPANEL_SECRET,
      },
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
    return mcpClient;
  }

  it("covers all read tools against the mock API", async () => {
    const mcpClient = await createLinkedClient();
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [
      {
        name: MIXPANEL_REPORT_GET_TOOL,
        arguments: { bookmarkId: "10" },
      },
      {
        name: MIXPANEL_SEGMENTATION_RUN_TOOL,
        arguments: {
          event: "Sign Up",
          fromDate: "2024-01-01",
          toDate: "2024-01-07",
        },
      },
      {
        name: MIXPANEL_FUNNEL_GET_TOOL,
        arguments: {
          funnelId: "20",
          fromDate: "2024-01-01",
          toDate: "2024-01-07",
        },
      },
      {
        name: MIXPANEL_RETENTION_RUN_TOOL,
        arguments: {
          bornEvent: "Sign Up",
          event: "Purchase",
          fromDate: "2024-01-01",
          toDate: "2024-01-14",
        },
      },
      { name: MIXPANEL_COHORT_LIST_TOOL, arguments: { limit: 10 } },
    ];

    for (const call of calls) {
      const result = await mcpClient.callTool(call);
      expect(result.isError).not.toBe(true);
    }
    expect(server?.getRequestCount()).toBeGreaterThanOrEqual(calls.length);
  });

  it("enforces bookmark allowlist", async () => {
    const mcpClient = await createLinkedClient({
      allowedBookmarkIds: ["10"],
    });
    const ok = await mcpClient.callTool({
      name: MIXPANEL_REPORT_GET_TOOL,
      arguments: { bookmarkId: "10" },
    });
    expect(ok.isError).not.toBe(true);

    const denied = await mcpClient.callTool({
      name: MIXPANEL_REPORT_GET_TOOL,
      arguments: { bookmarkId: "99" },
    });
    expect(denied.isError).toBe(true);
  });

  it("denies all bookmarks when allowlist is empty", async () => {
    const mcpClient = await createLinkedClient({ allowedBookmarkIds: [] });
    const denied = await mcpClient.callTool({
      name: MIXPANEL_REPORT_GET_TOOL,
      arguments: { bookmarkId: "10" },
    });
    expect(denied.isError).toBe(true);
  });

  it("maps provider unauthorized without leaking secrets", async () => {
    server = await startMockMixpanelHttpServer({ mode: "unauthorized" });
    const client = createTestMixpanelClient(server);
    const connector = createMixpanelConnector({
      client,
      config: createTestMixpanelConfig(),
      credentialsForRedaction: {
        username: FAKE_MIXPANEL_USERNAME,
        secret: FAKE_MIXPANEL_SECRET,
      },
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "err", version: "1" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const result = await mcpClient.callTool({
      name: MIXPANEL_REPORT_GET_TOOL,
      arguments: { bookmarkId: "1" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(FAKE_MIXPANEL_SECRET);
    const mapped = mapMixpanelError(
      { kind: "http", status: 401, mixpanelMessage: FAKE_MIXPANEL_SECRET },
      {
        serviceAccountUsername: FAKE_MIXPANEL_USERNAME,
        serviceAccountSecret: FAKE_MIXPANEL_SECRET,
      },
    );
    expect(mapped).toBeInstanceOf(ConnectorSdkError);
    expect(mapped.code).toBe("UNAUTHORIZED");
  });
});
