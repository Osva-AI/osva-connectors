import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { GITHUB_REPOSITORY_GET_TOOL } from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import {
  createMockGithubClient,
  sampleRepository,
} from "./helpers/mock-github-client.js";

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

  it("supports tools/list and tools/call via the published connector SDK", async () => {
    const connector = createGithubConnector({
      client: createMockGithubClient(),
    });
    const server = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(client);

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools({});
    expect(tools.tools.map((tool) => tool.name)).toContain(
      GITHUB_REPOSITORY_GET_TOOL,
    );

    const result = await client.callTool({
      name: GITHUB_REPOSITORY_GET_TOOL,
      arguments: { owner: "Osva-AI", repo: "osva" },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      name: sampleRepository.name,
      fullName: sampleRepository.full_name,
      htmlUrl: sampleRepository.html_url,
    });
  });

  it("returns structured tool errors for invalid input", async () => {
    const connector = createGithubConnector({
      client: createMockGithubClient(),
    });
    const server = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(client);

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: GITHUB_REPOSITORY_GET_TOOL,
      arguments: { owner: "-invalid-", repo: "osva" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
