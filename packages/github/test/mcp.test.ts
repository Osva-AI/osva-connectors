import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GITHUB_ISSUE_CREATE_TOOL,
  GITHUB_ISSUE_GET_TOOL,
  GITHUB_ISSUE_LIST_TOOL,
  GITHUB_REPOSITORY_GET_TOOL,
} from "../src/constants.js";
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
    const toolNames = tools.tools.map((tool) => tool.name);
    expect(toolNames).toEqual(
      expect.arrayContaining([
        GITHUB_REPOSITORY_GET_TOOL,
        GITHUB_ISSUE_LIST_TOOL,
        GITHUB_ISSUE_GET_TOOL,
        GITHUB_ISSUE_CREATE_TOOL,
      ]),
    );
    expect(new Set(toolNames).size).toBe(toolNames.length);

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

  it("calls github.issue.list via MCP with default pagination when optional fields are omitted", async () => {
    const mockClient = createMockGithubClient();
    const connector = createGithubConnector({ client: mockClient });
    const server = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(client);

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: GITHUB_ISSUE_LIST_TOOL,
      arguments: { owner: "Osva-AI", repo: "osva" },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      page: 1,
      perPage: 20,
      issues: expect.any(Array),
    });
    expect(JSON.stringify(result)).not.toMatch(
      /pull_request|Octokit|HttpError/i,
    );
    expect(mockClient.listIssues).toHaveBeenCalledTimes(1);
    expect(mockClient.listIssues).toHaveBeenCalledWith({
      owner: "Osva-AI",
      repo: "osva",
      state: "open",
      perPage: 20,
      page: 1,
      signal: undefined,
    });
  });

  it("calls github.issue.create via MCP with injected provider", async () => {
    const mockClient = createMockGithubClient();
    const connector = createGithubConnector({ client: mockClient });
    const server = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "1.0.0" });
    clients.push(client);

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: GITHUB_ISSUE_CREATE_TOOL,
      arguments: {
        owner: "Osva-AI",
        repo: "osva",
        title: "MCP create",
        body: "From test",
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      number: 42,
      title: "Example issue",
      htmlUrl: expect.stringContaining("github.com"),
    });
    expect(JSON.stringify(result)).not.toMatch(
      /pull_request|Octokit|HttpError|ghp_/i,
    );
    expect(mockClient.createIssue).toHaveBeenCalledTimes(1);
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
