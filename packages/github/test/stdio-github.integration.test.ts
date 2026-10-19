import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { GITHUB_REPOSITORY_GET_TOOL } from "../src/constants.js";
import {
  FAKE_GITHUB_PAT,
  MOCK_REPOSITORY_JSON,
  startMockGithubHttpServer,
  type MockGithubHttpServer,
} from "./fixtures/mock-github-http-server.js";

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));
const STDIO_FIXTURE_SCRIPT = path.join(
  FIXTURE_DIR,
  "fixtures",
  ".build",
  "stdio-github-fixture.js",
);

function fixtureAvailable(): boolean {
  return fs.existsSync(STDIO_FIXTURE_SCRIPT);
}

describe("GitHub connector stdio integration (mock GitHub HTTP)", () => {
  let mockGithub: MockGithubHttpServer | undefined;
  const clients: Client[] = [];

  beforeAll(() => {
    if (!fixtureAvailable()) {
      throw new Error(
        `Missing ${STDIO_FIXTURE_SCRIPT}. Run: pnpm --filter @osva-ai/connector-github build && pnpm --filter @osva-ai/connector-github build:test-stdio-fixture`,
      );
    }
  });

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
    if (mockGithub !== undefined) {
      await mockGithub.close();
      mockGithub = undefined;
    }
  });

  async function connectClient(token: string): Promise<Client> {
    if (mockGithub === undefined) {
      throw new Error("Mock GitHub server is not started.");
    }

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [STDIO_FIXTURE_SCRIPT],
      env: {
        OSVA_CONNECTOR_GITHUB_TOKEN: token,
        OSVA_CONNECTOR_GITHUB_TEST_API_BASE_URL: mockGithub.apiBaseUrl,
      },
      stderr: "pipe",
    });

    const client = new Client({
      name: "connector-github-stdio-test",
      version: "1.0.0",
    });
    clients.push(client);
    await client.connect(transport);
    return client;
  }

  it("calls github.repository.get over stdio against the mock GitHub API", async () => {
    mockGithub = await startMockGithubHttpServer();
    const client = await connectClient(FAKE_GITHUB_PAT);

    const result = await client.callTool({
      name: GITHUB_REPOSITORY_GET_TOOL,
      arguments: { owner: "Osva-AI", repo: "osva" },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      name: MOCK_REPOSITORY_JSON.name,
      fullName: MOCK_REPOSITORY_JSON.full_name,
      htmlUrl: MOCK_REPOSITORY_JSON.html_url,
    });

    expect(mockGithub.getRepositoryRequestCount()).toBe(1);
    expect(mockGithub.getLastAuthorization()?.toLowerCase()).toContain(
      FAKE_GITHUB_PAT.toLowerCase(),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/ghp_osva_test_fixture|authorization/i);
  });

  it("returns a sanitized authorization failure for wrong credentials", async () => {
    mockGithub = await startMockGithubHttpServer();
    const client = await connectClient("ghp_wrong_token_for_test");

    const result = await client.callTool({
      name: GITHUB_REPOSITORY_GET_TOOL,
      arguments: { owner: "Osva-AI", repo: "osva" },
    });

    expect(result.isError).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).toMatch(/UNAUTHORIZED|authentication failed/i);
    expect(serialized).not.toContain("ghp_wrong_token_for_test");
    expect(serialized).not.toContain("DO_NOT_LEAK");
  });
});
