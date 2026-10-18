import { describe, expect, it } from "vitest";

import {
  GITHUB_ISSUE_LIST_TOOL,
  ISSUE_LIST_MAX_PAGE,
  ISSUE_LIST_MAX_PER_PAGE,
  MAX_LABELS_PER_ISSUE,
} from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import type { IssueListOutput } from "../src/issue-schemas.js";
import { linkHeaderHasNextPage } from "../src/parse-github-link.js";
import { createGithubRequestError } from "./helpers/request-error.js";
import {
  createMockGithubClient,
  sampleIssue,
  samplePullRequest,
} from "./helpers/mock-github-client.js";
import { TEST_GITHUB_TOKEN } from "./helpers/test-env.js";

function getListTool(connector: ReturnType<typeof createGithubConnector>) {
  const tool = connector.tools.find((t) => t.name === GITHUB_ISSUE_LIST_TOOL);
  expect(tool).toBeDefined();
  return tool!;
}

describe("github.issue.list", () => {
  it("lists issues with default pagination and state", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva" },
      {},
    )) as IssueListOutput;

    expect(output).toMatchObject({
      page: 1,
      perPage: 20,
      issues: [
        expect.objectContaining({
          number: 42,
          title: "Example issue",
          authorLogin: "octocat",
        }),
      ],
    });
    expect(output).not.toHaveProperty("hasNextPage");
    expect(client.listIssues).toHaveBeenCalledTimes(1);
    expect(client.listIssues).toHaveBeenCalledWith({
      owner: "Osva-AI",
      repo: "osva",
      state: "open",
      perPage: 20,
      page: 1,
      signal: undefined,
    });
  });

  it("honors custom state and pagination", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    await tool.handler(
      {
        owner: "Osva-AI",
        repo: "osva",
        state: "closed",
        perPage: 50,
        page: 2,
      },
      {},
    );

    expect(client.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "closed",
        perPage: 50,
        page: 2,
      }),
    );
  });

  it("filters pull requests from list results", async () => {
    const client = createMockGithubClient({
      listIssues: async () => ({
        items: [sampleIssue, samplePullRequest],
        page: 1,
        perPage: 20,
        hasNextPage: false,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva" },
      {},
    )) as IssueListOutput;

    expect(output.issues).toHaveLength(1);
    expect(output.issues[0]?.number).toBe(42);
  });

  it("returns empty issues array when provider page is empty", async () => {
    const client = createMockGithubClient({
      listIssues: async () => ({
        items: [],
        page: 1,
        perPage: 20,
        hasNextPage: false,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva" },
      {},
    )) as IssueListOutput;
    expect(output.issues).toEqual([]);
  });

  it("can return sparse pages after pull request filtering", async () => {
    const client = createMockGithubClient({
      listIssues: async () => ({
        items: [samplePullRequest, samplePullRequest, sampleIssue],
        page: 2,
        perPage: 20,
        hasNextPage: true,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva", page: 2 },
      {},
    )) as IssueListOutput;

    expect(output.issues).toHaveLength(1);
    expect(output.hasNextPage).toBe(true);
  });

  it("sets hasNextPage only when GitHub Link header indicates a next page", async () => {
    expect(linkHeaderHasNextPage(undefined)).toBe(false);
    expect(
      linkHeaderHasNextPage(
        '<https://api.github.com/repos/o/r/issues?page=2>; rel="next", <https://api.github.com/repos/o/r/issues?page=5>; rel="last"',
      ),
    ).toBe(true);

    const client = createMockGithubClient({
      listIssues: async () => ({
        items: [sampleIssue],
        page: 1,
        perPage: 100,
        hasNextPage: true,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva", perPage: 100 },
      {},
    )) as IssueListOutput;
    expect(output.hasNextPage).toBe(true);
  });

  it("does not infer hasNextPage from issue count alone", async () => {
    const fullPage = Array.from({ length: 20 }, (_, index) => ({
      ...sampleIssue,
      number: index + 1,
    }));
    const client = createMockGithubClient({
      listIssues: async () => ({
        items: fullPage,
        page: 1,
        perPage: 20,
        hasNextPage: false,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva" },
      {},
    )) as IssueListOutput;
    expect(output.issues).toHaveLength(20);
    expect(output).not.toHaveProperty("hasNextPage");
  });

  it("rejects pagination above maximum bounds", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", page: ISSUE_LIST_MAX_PAGE + 1 },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler(
        {
          owner: "Osva-AI",
          repo: "osva",
          perPage: ISSUE_LIST_MAX_PER_PAGE + 1,
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.listIssues).not.toHaveBeenCalled();
  });

  it("rejects invalid owner, repo, and state without provider calls", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    await expect(
      tool.handler({ owner: "-bad-", repo: "osva" }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", state: "invalid" }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.listIssues).not.toHaveBeenCalled();
  });

  it("truncates labels according to output-size policy", async () => {
    const manyLabels = Array.from(
      { length: MAX_LABELS_PER_ISSUE + 5 },
      (_, i) => ({
        name: `label-${i}`,
      }),
    );
    const client = createMockGithubClient({
      listIssues: async () => ({
        items: [{ ...sampleIssue, labels: manyLabels }],
        page: 1,
        perPage: 20,
        hasNextPage: false,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva" },
      {},
    )) as IssueListOutput;
    expect(output.issues[0]?.labels).toHaveLength(MAX_LABELS_PER_ISSUE);
    expect(output.issues[0]?.labelsTruncated).toBe(true);
  });

  it("maps provider auth and rate-limit errors safely", async () => {
    const client = createMockGithubClient({
      listIssues: async () => {
        throw createGithubRequestError(401, "Bad credentials");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva" }, {}),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("propagates cancellation through error mapping", async () => {
    const client = createMockGithubClient({
      listIssues: async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva" }, {}),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("sanitizes unknown provider exceptions", async () => {
    const client = createMockGithubClient({
      listIssues: async () => {
        throw new Error(`failed token=${TEST_GITHUB_TOKEN}`);
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    try {
      await tool.handler({ owner: "Osva-AI", repo: "osva" }, {});
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_ERROR" });
      expect(String(error)).not.toContain(TEST_GITHUB_TOKEN);
    }
  });

  it("rejects malformed provider payloads", async () => {
    const client = createMockGithubClient({
      listIssues: async () => ({
        items: [{ ...sampleIssue, html_url: "not-a-url" }],
        page: 1,
        perPage: 20,
        hasNextPage: false,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getListTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva" }, {}),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });
});
