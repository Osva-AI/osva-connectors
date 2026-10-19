import { describe, expect, it, vi } from "vitest";

import {
  GITHUB_ISSUE_COMMENT_CREATE_TOOL,
  GITHUB_REPOSITORY_GET_TOOL,
  ISSUE_COMMENT_CREATE_MAX_BODY_LENGTH,
} from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import { createGithubRequestError } from "./helpers/request-error.js";
import {
  createMockGithubClient,
  sampleIssueComment,
  samplePullRequest,
} from "./helpers/mock-github-client.js";
import { TEST_GITHUB_TOKEN } from "./helpers/test-env.js";

function getCommentCreateTool(
  connector: ReturnType<typeof createGithubConnector>,
) {
  const tool = connector.tools.find(
    (t) => t.name === GITHUB_ISSUE_COMMENT_CREATE_TOOL,
  );
  expect(tool).toBeDefined();
  return tool!;
}

describe("github.issue.comment.create", () => {
  it("creates a comment with normalized output on success", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    const output = await tool.handler(
      {
        owner: "Osva-AI",
        repo: "osva",
        issueNumber: 42,
        body: "  Hello from test  ",
      },
      {},
    );

    expect(output).toEqual({
      id: sampleIssueComment.id,
      issueNumber: 42,
      body: sampleIssueComment.body,
      htmlUrl: sampleIssueComment.html_url,
      createdAt: sampleIssueComment.created_at,
      authorLogin: "octocat",
    });
    expect(output).not.toHaveProperty("user");
    expect(client.getIssue).toHaveBeenCalledTimes(1);
    expect(client.createIssueComment).toHaveBeenCalledTimes(1);
    expect(client.createIssueComment).toHaveBeenCalledWith({
      owner: "Osva-AI",
      repo: "osva",
      issueNumber: 42,
      body: "Hello from test",
      signal: undefined,
    });
  });

  it("rejects missing or empty body without provider calls", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "" },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "   " },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.getIssue).not.toHaveBeenCalled();
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });

  it("rejects invalid issue numbers and slugs without provider calls", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 0, body: "x" },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler(
        { owner: "-bad-", repo: "osva", issueNumber: 42, body: "x" },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.getIssue).not.toHaveBeenCalled();
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });

  it("rejects oversized body without provider calls", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        {
          owner: "Osva-AI",
          repo: "osva",
          issueNumber: 42,
          body: "x".repeat(ISSUE_COMMENT_CREATE_MAX_BODY_LENGTH + 1),
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.getIssue).not.toHaveBeenCalled();
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });

  it("rejects pull requests before the comment POST", async () => {
    const client = createMockGithubClient({
      getIssue: async () => samplePullRequest,
    });
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 99, body: "nope" },
        {},
      ),
    ).rejects.toMatchObject({ code: "NOT_ISSUE" });
    expect(client.getIssue).toHaveBeenCalledTimes(1);
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });

  it("maps missing issues to NOT_FOUND without comment POST", async () => {
    const client = createMockGithubClient({
      getIssue: async () => {
        throw createGithubRequestError(404, "Not Found");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 404, body: "x" },
        {},
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });

  it("does not retry after provider errors or timeouts on comment POST", async () => {
    const createIssueComment = vi
      .fn()
      .mockRejectedValueOnce(createGithubRequestError(500, "Server error"))
      .mockResolvedValueOnce(sampleIssueComment);
    const client = createMockGithubClient({ createIssueComment });
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "t" },
        {},
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR", retryable: false });
    expect(createIssueComment).toHaveBeenCalledTimes(1);

    const timeout = new Error("Timed out");
    timeout.name = "TimeoutError";
    createIssueComment.mockReset();
    createIssueComment
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(sampleIssueComment);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "t2" },
        {},
      ),
    ).rejects.toMatchObject({ code: "TIMEOUT", retryable: false });
    expect(createIssueComment).toHaveBeenCalledTimes(1);
  });

  it("maps ambiguous mutation failures with verify guidance", async () => {
    const client = createMockGithubClient({
      createIssueComment: async () => {
        throw createGithubRequestError(500, "Server error");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    try {
      await tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "t" },
        {},
      );
      expect.fail("Expected handler to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_ERROR", retryable: false });
      expect(String(error)).toMatch(/verify on GitHub/i);
    }
  });

  it("maps 401, 403, and rate-limit errors on comment POST without retryable hints", async () => {
    for (const [status, code, headers] of [
      [401, "UNAUTHORIZED", {}],
      [403, "FORBIDDEN", {}],
      [403, "RATE_LIMITED", { "x-ratelimit-remaining": "0" }],
      [429, "RATE_LIMITED", {}],
    ] as const) {
      const client = createMockGithubClient({
        createIssueComment: async () => {
          throw createGithubRequestError(status, "err", headers);
        },
      });
      const connector = createGithubConnector({ client });
      const tool = getCommentCreateTool(connector);

      try {
        await tool.handler(
          { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "t" },
          {},
        );
        expect.fail("Expected handler to throw");
      } catch (error) {
        expect(error).toMatchObject({ code });
        expect((error as { retryable?: boolean }).retryable).not.toBe(true);
        if (code === "RATE_LIMITED") {
          expect(String(error)).toMatch(/verify on GitHub/i);
        }
      }
    }
  });

  it("maps provider 422 validation failure to INVALID_INPUT", async () => {
    const client = createMockGithubClient({
      createIssueComment: async () => {
        throw createGithubRequestError(422, "Validation Failed");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "t" },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("sanitizes unexpected provider exceptions on comment POST", async () => {
    const client = createMockGithubClient({
      createIssueComment: async () => {
        throw new Error(`failed token=${TEST_GITHUB_TOKEN}`);
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    try {
      await tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "t" },
        {},
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_ERROR", retryable: false });
      expect(String(error)).not.toContain(TEST_GITHUB_TOKEN);
    }
  });

  it("propagates cancellation on comment POST", async () => {
    const client = createMockGithubClient({
      createIssueComment: async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "t" },
        {},
      ),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("rejects malformed provider comment payloads", async () => {
    const client = createMockGithubClient({
      createIssueComment: async () => ({
        ...sampleIssueComment,
        html_url: "not-a-url",
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getCommentCreateTool(connector);

    await expect(
      tool.handler(
        { owner: "Osva-AI", repo: "osva", issueNumber: 42, body: "t" },
        {},
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("does not change read-only github.repository.get behavior", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = connector.tools.find(
      (t) => t.name === GITHUB_REPOSITORY_GET_TOOL,
    );
    expect(tool).toBeDefined();

    await tool!.handler({ owner: "Osva-AI", repo: "osva" }, {});
    expect(client.getRepository).toHaveBeenCalledTimes(1);
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });
});
