import { describe, expect, it, vi } from "vitest";

import {
  GITHUB_ISSUE_CREATE_TOOL,
  ISSUE_CREATE_MAX_BODY_LENGTH,
  ISSUE_CREATE_MAX_TITLE_LENGTH,
} from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import { createGithubRequestError } from "./helpers/request-error.js";
import {
  createMockGithubClient,
  sampleIssue,
} from "./helpers/mock-github-client.js";
import { TEST_GITHUB_TOKEN } from "./helpers/test-env.js";

function getCreateTool(connector: ReturnType<typeof createGithubConnector>) {
  const tool = connector.tools.find((t) => t.name === GITHUB_ISSUE_CREATE_TOOL);
  expect(tool).toBeDefined();
  return tool!;
}

describe("github.issue.create", () => {
  it("creates an issue with normalized output on success", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    const output = await tool.handler(
      { owner: "Osva-AI", repo: "osva", title: "  New issue  " },
      {},
    );

    expect(output).toEqual({
      number: 42,
      title: "Example issue",
      state: "open",
      htmlUrl: sampleIssue.html_url,
      createdAt: sampleIssue.created_at,
      authorLogin: "octocat",
    });
    expect(output).not.toHaveProperty("body");
    expect(output).not.toHaveProperty("updatedAt");
    expect(client.createIssue).toHaveBeenCalledTimes(1);
    expect(client.createIssue).toHaveBeenCalledWith({
      owner: "Osva-AI",
      repo: "osva",
      title: "New issue",
      signal: undefined,
    });
  });

  it("forwards optional body to the provider", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    await tool.handler(
      {
        owner: "Osva-AI",
        repo: "osva",
        title: "With body",
        body: "## Details\n\nHello",
      },
      {},
    );

    expect(client.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "With body",
        body: "## Details\n\nHello",
      }),
    );
  });

  it("rejects missing or empty title without provider calls", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", title: "" }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", title: "   " }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.createIssue).not.toHaveBeenCalled();
  });

  it("rejects oversized title and body without provider calls", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    await expect(
      tool.handler(
        {
          owner: "Osva-AI",
          repo: "osva",
          title: "x".repeat(ISSUE_CREATE_MAX_TITLE_LENGTH + 1),
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      tool.handler(
        {
          owner: "Osva-AI",
          repo: "osva",
          title: "ok",
          body: "y".repeat(ISSUE_CREATE_MAX_BODY_LENGTH + 1),
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.createIssue).not.toHaveBeenCalled();
  });

  it("rejects invalid owner and repo without provider calls", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    await expect(
      tool.handler({ owner: "-bad-", repo: "osva", title: "t" }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.createIssue).not.toHaveBeenCalled();
  });

  it("does not retry after provider errors or timeouts", async () => {
    const createIssue = vi
      .fn()
      .mockRejectedValueOnce(createGithubRequestError(500, "Server error"))
      .mockResolvedValueOnce(sampleIssue);
    const client = createMockGithubClient({ createIssue });
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", title: "t" }, {}),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(createIssue).toHaveBeenCalledTimes(1);

    const timeout = new Error("Timed out");
    timeout.name = "TimeoutError";
    createIssue.mockReset();
    createIssue
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(sampleIssue);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", title: "t2" }, {}),
    ).rejects.toMatchObject({ code: "TIMEOUT", retryable: false });
    expect(createIssue).toHaveBeenCalledTimes(1);
  });

  it("maps 401, 403, and rate-limit errors without retryable mutation hints", async () => {
    for (const [status, code, headers] of [
      [401, "UNAUTHORIZED", {}],
      [403, "FORBIDDEN", {}],
      [403, "RATE_LIMITED", { "x-ratelimit-remaining": "0" }],
      [429, "RATE_LIMITED", {}],
    ] as const) {
      const client = createMockGithubClient({
        createIssue: async () => {
          throw createGithubRequestError(status, "err", headers);
        },
      });
      const connector = createGithubConnector({ client });
      const tool = getCreateTool(connector);

      try {
        await tool.handler({ owner: "Osva-AI", repo: "osva", title: "t" }, {});
        expect.fail("Expected handler to throw");
      } catch (error) {
        expect(error).toMatchObject({ code });
        expect((error as { retryable?: boolean }).retryable).not.toBe(true);
        expect(String(error)).not.toMatch(/not created|was not created/i);
      }
    }
  });

  it("maps provider 422 validation failure to INVALID_INPUT", async () => {
    const client = createMockGithubClient({
      createIssue: async () => {
        throw createGithubRequestError(422, "Validation Failed");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", title: "t" }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("sanitizes unexpected provider exceptions", async () => {
    const client = createMockGithubClient({
      createIssue: async () => {
        throw new Error(`failed token=${TEST_GITHUB_TOKEN}`);
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    try {
      await tool.handler({ owner: "Osva-AI", repo: "osva", title: "t" }, {});
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_ERROR" });
      expect(String(error)).not.toContain(TEST_GITHUB_TOKEN);
    }
  });

  it("propagates cancellation", async () => {
    const client = createMockGithubClient({
      createIssue: async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", title: "t" }, {}),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("rejects malformed provider payloads", async () => {
    const client = createMockGithubClient({
      createIssue: async () => ({ ...sampleIssue, html_url: "not-a-url" }),
    });
    const connector = createGithubConnector({ client });
    const tool = getCreateTool(connector);

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva", title: "t" }, {}),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("does not change read-only issue.get behavior", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const getTool = connector.tools.find((t) => t.name === "github.issue.get");
    expect(getTool).toBeDefined();

    const output = await getTool!.handler(
      { owner: "Osva-AI", repo: "osva", issueNumber: 42 },
      {},
    );
    expect(output).toMatchObject({ number: 42 });
    expect(client.getIssue).toHaveBeenCalledTimes(1);
    expect(client.createIssue).not.toHaveBeenCalled();
  });
});
