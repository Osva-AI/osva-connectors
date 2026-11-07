import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  LINEAR_COMMENT_CREATE_TOOL,
  LINEAR_ISSUE_CREATE_TOOL,
  LINEAR_ISSUE_LIST_TOOL,
  LINEAR_ISSUE_SEARCH_TOOL,
} from "../src/constants.js";
import { createLinearConnector } from "../src/connector.js";
import { linearConfigSchema } from "../src/schemas.js";
import {
  MOCK_ISSUE_ID,
  MOCK_TEAM_ID,
  startMockLinearGraphqlServer,
  type MockLinearGraphqlServer,
} from "./fixtures/mock-linear-graphql-server.js";
import { createTestLinearClient } from "./helpers/test-env.js";

describe("Linear connector (fake provider)", () => {
  let server: MockLinearGraphqlServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function connector(readOnly = true, allowedTeamIds: string[] = []) {
    server = await startMockLinearGraphqlServer();
    const client = createTestLinearClient(server);
    const config = linearConfigSchema.parse({
      authorizationHeader: "lin_api_fixture",
      credentialForRedaction: "lin_api_fixture",
      writeEnabled: !readOnly,
      hostMutationsApproved: !readOnly,
      allowedTeamIds,
    });
    return { conn: createLinearConnector({ client, config }), server };
  }

  it("requires teamId for issue.list when team allowlist is configured", async () => {
    const { conn } = await connector(true, [MOCK_TEAM_ID]);
    const tool = conn.tools.find((t) => t.name === LINEAR_ISSUE_LIST_TOOL);
    await expect(
      tool!.handler({ first: 5 }, { signal: undefined }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("lists issues with pagination envelope", async () => {
    const { conn } = await connector();
    const tool = conn.tools.find((t) => t.name === LINEAR_ISSUE_LIST_TOOL);
    expect(tool).toBeDefined();
    const output = await tool!.handler({ first: 10 }, { signal: undefined });
    expect(output).toMatchObject({
      hasNextPage: true,
      endCursor: "cursor-issues-1",
      issues: expect.any(Array),
    });
  });

  it("searches issues", async () => {
    const { conn } = await connector();
    const tool = conn.tools.find((t) => t.name === LINEAR_ISSUE_SEARCH_TOOL);
    const output = await tool!.handler(
      { query: "fixture", first: 5 },
      { signal: undefined },
    );
    expect(output).toMatchObject({ issues: expect.any(Array) });
  });

  it("denies mutations when write flags are off", async () => {
    const { conn } = await connector(true);
    const tool = conn.tools.find((t) => t.name === LINEAR_ISSUE_CREATE_TOOL);
    await expect(
      tool!.handler(
        { teamId: MOCK_TEAM_ID, title: "New issue" },
        { signal: undefined },
      ),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("denies mutations for teams outside allowlist", async () => {
    const { conn } = await connector(false, [
      "99999999-9999-4999-8999-999999999999",
    ]);
    const tool = conn.tools.find((t) => t.name === LINEAR_ISSUE_CREATE_TOOL);
    await expect(
      tool!.handler(
        { teamId: MOCK_TEAM_ID, title: "New issue" },
        { signal: undefined },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates issue when writes and team are allowed", async () => {
    const { conn } = await connector(false, [MOCK_TEAM_ID]);
    const tool = conn.tools.find((t) => t.name === LINEAR_ISSUE_CREATE_TOOL);
    const output = await tool!.handler(
      { teamId: MOCK_TEAM_ID, title: "Created" },
      { signal: undefined },
    );
    expect(output).toMatchObject({ id: MOCK_ISSUE_ID });
  });

  it("creates comment when writes are enabled", async () => {
    const { conn } = await connector(false, [MOCK_TEAM_ID]);
    const tool = conn.tools.find((t) => t.name === LINEAR_COMMENT_CREATE_TOOL);
    const output = await tool!.handler(
      { issueId: MOCK_ISSUE_ID, body: "Hello" },
      { signal: undefined },
    );
    expect(output).toMatchObject({ body: expect.any(String) });
  });

  it("maps unauthorized provider responses", async () => {
    server = await startMockLinearGraphqlServer();
    server.setMode("unauthorized");
    const client = createTestLinearClient(server);
    const config = linearConfigSchema.parse({
      authorizationHeader: "lin_api_fixture",
      credentialForRedaction: "lin_api_fixture",
    });
    const conn = createLinearConnector({ client, config });
    const tool = conn.tools.find((t) => t.name === LINEAR_ISSUE_LIST_TOOL);
    await expect(
      tool!.handler({}, { signal: undefined }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("maps graphql partial errors", async () => {
    server = await startMockLinearGraphqlServer({ mode: "partial_error" });
    const client = createTestLinearClient(server);
    const config = linearConfigSchema.parse({
      authorizationHeader: "lin_api_fixture",
      credentialForRedaction: "lin_api_fixture",
    });
    const conn = createLinearConnector({ client, config });
    const tool = conn.tools.find((t) => t.name === LINEAR_ISSUE_LIST_TOOL);
    await expect(
      tool!.handler({}, { signal: undefined }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });
});
