import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { SLACK_MESSAGE_POST_TOOL } from "../src/constants.js";
import { createSlackConnector } from "../src/connector.js";
import { mapSlackError } from "../src/map-slack-error.js";
import {
  FAKE_SLACK_BOT_TOKEN,
  MOCK_CHANNEL_PUBLIC,
  startMockSlackHttpServer,
  type MockSlackHttpServer,
  type MockSlackMode,
} from "./fixtures/mock-slack-http-server.js";
import {
  createTestSlackClient,
  createTestSlackConfig,
} from "./helpers/test-env.js";

describe("Slack write semantics", () => {
  const clients: Client[] = [];
  let server: MockSlackHttpServer | undefined;

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

  async function createWriteClient(mode?: MockSlackMode) {
    server = await startMockSlackHttpServer(mode !== undefined ? { mode } : {});
    const config = createTestSlackConfig({ writeEnabled: true });
    const client = createTestSlackClient(server);
    const connector = createSlackConnector({
      client,
      config,
      botTokenForRedaction: FAKE_SLACK_BOT_TOKEN,
    });
    const mcpServer = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "write-test", version: "1.0" });
    clients.push(mcpClient);
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return { mcpClient, server };
  }

  it("maps ambiguous write failures without retryable hints", async () => {
    const timeout = new Error("Slack request timed out.");
    timeout.name = "TimeoutError";
    const mapped = mapSlackError(timeout, { ambiguousWrite: true });
    expect(mapped.retryable).not.toBe(true);
    expect(mapped.message).toContain("verify in Slack");
  });

  it("issues exactly one post attempt on provider 500", async () => {
    server = await startMockSlackHttpServer({ mode: "server_error" });
    const client = createTestSlackClient(server);
    await expect(
      client.postMessage({ channelId: MOCK_CHANNEL_PUBLIC, text: "hi" }),
    ).rejects.toBeTruthy();
    expect(server.getPostMessageCount()).toBe(0);
    expect(server.getRequestCount()).toBe(1);
  });

  it("returns indeterminate messaging on ambiguous write provider failure", async () => {
    const { mcpClient } = await createWriteClient("server_error");
    const result = await mcpClient.callTool({
      name: SLACK_MESSAGE_POST_TOOL,
      arguments: { channelId: MOCK_CHANNEL_PUBLIC, text: "hello" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("verify in Slack");
  });
});
