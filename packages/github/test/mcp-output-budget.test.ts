import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  GITHUB_ISSUE_COMMENT_CREATE_TOOL,
  GITHUB_ISSUE_CREATE_TOOL,
  GITHUB_ISSUE_GET_TOOL,
  GITHUB_ISSUE_LIST_TOOL,
  GITHUB_REPOSITORY_GET_TOOL,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import { structuredOutputByteLength } from "../src/output-budget.js";
import { createMockGithubClient } from "./helpers/mock-github-client.js";

function utf8Bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

describe("MCP tools/call serialized response budgets", () => {
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

  async function callToolViaMcp(
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const connector = createGithubConnector({
      client: createMockGithubClient(),
    });
    const server = createMcpServerFromConnector(connector);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "mcp-budget-test", version: "1.0.0" });
    clients.push(client);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return client.callTool({ name: toolName, arguments: args });
  }

  const toolCalls = [
    {
      name: GITHUB_REPOSITORY_GET_TOOL,
      arguments: { owner: "Osva-AI", repo: "osva" },
    },
    {
      name: GITHUB_ISSUE_LIST_TOOL,
      arguments: { owner: "Osva-AI", repo: "osva" },
    },
    {
      name: GITHUB_ISSUE_GET_TOOL,
      arguments: { owner: "Osva-AI", repo: "osva", issueNumber: 42 },
    },
    {
      name: GITHUB_ISSUE_CREATE_TOOL,
      arguments: {
        owner: "Osva-AI",
        repo: "osva",
        title: "Budget probe",
      },
    },
    {
      name: GITHUB_ISSUE_COMMENT_CREATE_TOOL,
      arguments: {
        owner: "Osva-AI",
        repo: "osva",
        issueNumber: 42,
        body: "Budget probe comment",
      },
    },
  ] as const;

  it("keeps structuredContent within the connector budget for all five tools", async () => {
    for (const { name, arguments: args } of toolCalls) {
      const result = await callToolViaMcp(name, args);
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toBeDefined();

      const structuredBytes = structuredOutputByteLength(
        result.structuredContent,
      );
      expect(structuredBytes).toBeLessThanOrEqual(
        OUTPUT_MAX_STRUCTURED_JSON_BYTES,
      );
    }
  });

  it("records full CallToolResult size including duplicated text content", async () => {
    const measurements: {
      tool: string;
      structuredUtf8Bytes: number;
      fullMcpUtf8Bytes: number;
      textBlockUtf8Bytes: number;
    }[] = [];

    for (const { name, arguments: args } of toolCalls) {
      const result = await callToolViaMcp(name, args);
      const structuredBytes = structuredOutputByteLength(
        result.structuredContent,
      );
      const fullBytes = utf8Bytes(result);
      const textBlock = result.content?.[0];
      const textBytes =
        textBlock?.type === "text"
          ? Buffer.byteLength(textBlock.text, "utf8")
          : 0;

      measurements.push({
        tool: name,
        structuredUtf8Bytes: structuredBytes,
        fullMcpUtf8Bytes: fullBytes,
        textBlockUtf8Bytes: textBytes,
      });

      expect(structuredBytes).toBeLessThanOrEqual(
        OUTPUT_MAX_STRUCTURED_JSON_BYTES,
      );
      // SDK mirrors structuredContent in content[].text — full MCP payload is larger.
      expect(fullBytes).toBeGreaterThanOrEqual(structuredBytes);
      if (textBytes > 0) {
        expect(textBytes).toBeGreaterThanOrEqual(structuredBytes);
      }
    }

    expect(measurements).toHaveLength(5);
  });
});
