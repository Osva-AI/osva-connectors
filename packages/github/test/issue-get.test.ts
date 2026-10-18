import { describe, expect, it } from "vitest";

import { GITHUB_ISSUE_GET_TOOL } from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import { createGithubRequestError } from "./helpers/request-error.js";
import {
  createMockGithubClient,
  sampleIssue,
  samplePullRequest,
} from "./helpers/mock-github-client.js";
import { TEST_GITHUB_TOKEN } from "./helpers/test-env.js";

function getIssueTool(connector: ReturnType<typeof createGithubConnector>) {
  const tool = connector.tools.find((t) => t.name === GITHUB_ISSUE_GET_TOOL);
  expect(tool).toBeDefined();
  return tool!;
}

describe("github.issue.get", () => {
  it("returns a normalized issue on success", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getIssueTool(connector);

    const output = await tool.handler(
      { owner: "Osva-AI", repo: "osva", issueNumber: 42 },
      {},
    );

    expect(output).toMatchObject({
      number: 42,
      title: "Example issue",
      htmlUrl: sampleIssue.html_url,
      authorLogin: "octocat",
      labels: ["bug"],
    });
    expect(output).not.toHaveProperty("body");
    expect(client.getIssue).toHaveBeenCalledTimes(1);
  });

  it("maps issue not found to NOT_FOUND", async () => {
    const client = createMockGithubClient({
      getIssue: async () => {
        throw createGithubRequestError(404, "Not Found");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getIssueTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", issueNumber: 404 }, {}),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects invalid issue numbers without provider calls", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getIssueTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", issueNumber: 0 }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", issueNumber: -1 }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.getIssue).not.toHaveBeenCalled();
  });

  it("rejects pull request numbers with NOT_ISSUE", async () => {
    const client = createMockGithubClient({
      getIssue: async () => samplePullRequest,
    });
    const connector = createGithubConnector({ client });
    const tool = getIssueTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", issueNumber: 99 }, {}),
    ).rejects.toMatchObject({ code: "NOT_ISSUE" });
  });

  it("rejects malformed provider payloads", async () => {
    const client = createMockGithubClient({
      getIssue: async () => ({ ...sampleIssue, html_url: "not-a-url" }),
    });
    const connector = createGithubConnector({ client });
    const tool = getIssueTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", issueNumber: 42 }, {}),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("does not leak secrets in sanitized errors", async () => {
    const client = createMockGithubClient({
      getIssue: async () => {
        throw new Error(`secret ${TEST_GITHUB_TOKEN}`);
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getIssueTool(connector);

    try {
      await tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42 },
        {},
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_ERROR" });
      expect(String(error)).not.toContain(TEST_GITHUB_TOKEN);
    }
  });
});
