import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  GITHUB_ISSUE_COMMENT_CREATE_TOOL,
  GITHUB_ISSUE_LIST_TOOL,
  GITHUB_REPOSITORY_GET_TOOL,
  OUTPUT_MAX_ISSUE_TITLE,
  OUTPUT_MAX_REPO_DESCRIPTION,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import type {
  IssueCommentCreateOutput,
  IssueListOutput,
} from "../src/issue-schemas.js";
import { mapRepositoryRecord } from "../src/map-repository.js";
import {
  assertStructuredOutputWithinBudget,
  packIssuesWithinOutputBudget,
  structuredOutputByteLength,
  truncateUnicodeByCodePoints,
} from "../src/output-budget.js";
import { hostileIssueTitle } from "./helpers/hostile-content-fixtures.js";
import {
  createMockGithubClient,
  sampleIssue,
  sampleIssueComment,
  sampleRepository,
} from "./helpers/mock-github-client.js";
import { TEST_GITHUB_TOKEN } from "./helpers/test-env.js";

describe("truncateUnicodeByCodePoints", () => {
  it("preserves emoji and combining characters without splitting surrogate pairs", () => {
    const emoji = "👩‍👩‍👧‍👦";
    const { value, truncated } = truncateUnicodeByCodePoints(emoji, 2);
    expect(truncated).toBe(true);
    expect([...value].length).toBe(2);
    expect(value.length).toBeLessThan(emoji.length);
  });

  it("truncates astral characters as single code points", () => {
    const text = "😀😀😀";
    const { value, truncated } = truncateUnicodeByCodePoints(text, 2);
    expect(truncated).toBe(true);
    expect(value).toBe("😀😀");
  });

  it("handles lone surrogate code units without splitting valid pairs", () => {
    const validPair = "\uD83D\uDE00";
    const withLone = `a${validPair}b\uD800c`;
    const { value, truncated } = truncateUnicodeByCodePoints(withLone, 3);
    expect(truncated).toBe(true);
    expect([...value].length).toBe(3);
    expect(() => Buffer.byteLength(value, "utf8")).not.toThrow();
  });

  it("keeps UTF-8 byte length of truncated output within field budgets", () => {
    const emojiHeavy = "😀".repeat(8_000);
    const { value } = truncateUnicodeByCodePoints(emojiHeavy, 4_000);
    expect(Buffer.byteLength(value, "utf8")).toBeLessThanOrEqual(16_384);
    expect(structuredOutputByteLength({ body: value })).toBeLessThan(
      OUTPUT_MAX_STRUCTURED_JSON_BYTES,
    );
  });
});

describe("mapRepositoryRecord output bounds", () => {
  it("truncates long descriptions with descriptionTruncated", () => {
    const long = "x".repeat(OUTPUT_MAX_REPO_DESCRIPTION + 50);
    const output = mapRepositoryRecord({
      ...sampleRepository,
      description: long,
    });
    expect(output.description?.length).toBe(OUTPUT_MAX_REPO_DESCRIPTION);
    expect(output.descriptionTruncated).toBe(true);
  });

  it("rejects essential names that exceed output limits", () => {
    expect(() =>
      mapRepositoryRecord({
        ...sampleRepository,
        name: "n".repeat(500),
      }),
    ).toThrowError(ConnectorSdkError);
  });
});

describe("github.issue.list output budget", () => {
  it("sets issuesTruncated when serialized output exceeds the connector budget", async () => {
    const heavyLabels = Array.from({ length: 30 }, (_, i) => ({
      name: `label-${"L".repeat(90)}-${i}`,
    }));
    const items = Array.from({ length: 100 }, (_, i) => ({
      ...sampleIssue,
      number: i + 1,
      title: "T".repeat(OUTPUT_MAX_ISSUE_TITLE),
      labels: heavyLabels,
    }));
    const client = createMockGithubClient({
      listIssues: async () => ({
        items,
        page: 1,
        perPage: 100,
        hasNextPage: true,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools.find(
      (t) => t.name === GITHUB_ISSUE_LIST_TOOL,
    )!;

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva", perPage: 100 },
      {},
    )) as IssueListOutput;

    expect(output.issues.length).toBeLessThan(100);
    expect(output.issuesTruncated).toBe(true);
    expect(output.hasNextPage).toBe(true);
    expect(output.page).toBe(1);
    expect(output.perPage).toBe(100);
    expect(structuredOutputByteLength(output)).toBeLessThanOrEqual(
      OUTPUT_MAX_STRUCTURED_JSON_BYTES,
    );
  });

  it("does not set issuesTruncated when the GitHub page fits within budget", async () => {
    const client = createMockGithubClient({
      listIssues: async () => ({
        items: [sampleIssue],
        page: 2,
        perPage: 20,
        hasNextPage: true,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools.find(
      (t) => t.name === GITHUB_ISSUE_LIST_TOOL,
    )!;

    const output = (await tool.handler(
      { owner: "Osva-AI", repo: "osva", page: 2 },
      {},
    )) as IssueListOutput;

    expect(output.issues).toHaveLength(1);
    expect(output.hasNextPage).toBe(true);
    expect(output.issuesTruncated).toBeUndefined();
    expect(output.page).toBe(2);
  });

  it("measures serialized MCP-shaped JSON within budget", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = connector.tools.find(
      (t) => t.name === GITHUB_ISSUE_LIST_TOOL,
    )!;
    const output = await tool.handler({ owner: "Osva-AI", repo: "osva" }, {});
    const serialized = JSON.stringify({ structuredContent: output });
    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(
      OUTPUT_MAX_STRUCTURED_JSON_BYTES + 64,
    );
  });
});

describe("github.issue.comment.create output bounds", () => {
  it("truncates oversized provider comment bodies with bodyTruncated", async () => {
    const hugeBody = "c".repeat(40_000);
    const client = createMockGithubClient({
      createIssueComment: async () => ({
        ...sampleIssueComment,
        body: hugeBody,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools.find(
      (t) => t.name === GITHUB_ISSUE_COMMENT_CREATE_TOOL,
    )!;

    const output = (await tool.handler(
      {
        owner: "Osva-AI",
        repo: "osva",
        issueNumber: 42,
        body: "ok",
      },
      {},
    )) as IssueCommentCreateOutput;

    expect(output.body.length).toBeLessThan(hugeBody.length);
    expect(output.bodyTruncated).toBe(true);
    expect(output.id).toBe(sampleIssueComment.id);
    expect(output.issueNumber).toBe(42);
    expect(output.htmlUrl).toBe(sampleIssueComment.html_url);
    expect(client.createIssueComment).toHaveBeenCalledTimes(1);
  });

  it("keeps prompt-injection-style provider text as data", async () => {
    const client = createMockGithubClient({
      createIssueComment: async () => ({
        ...sampleIssueComment,
        body: hostileIssueTitle,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools.find(
      (t) => t.name === GITHUB_ISSUE_COMMENT_CREATE_TOOL,
    )!;

    const output = (await tool.handler(
      {
        owner: "Osva-AI",
        repo: "osva",
        issueNumber: 42,
        body: "ok",
      },
      {},
    )) as IssueCommentCreateOutput;

    expect(output.body).toBe(hostileIssueTitle);
    expect(client.getIssue).toHaveBeenCalledTimes(1);
    expect(client.createIssueComment).toHaveBeenCalledTimes(1);
  });
});

describe("packIssuesWithinOutputBudget", () => {
  it("throws sanitized PROVIDER_ERROR when the first issue cannot fit (never an empty success)", () => {
    const oversizedIssue = {
      number: 1,
      payload: "x".repeat(OUTPUT_MAX_STRUCTURED_JSON_BYTES),
    };

    try {
      packIssuesWithinOutputBudget({ page: 1, perPage: 1 }, [oversizedIssue]);
      expect.fail("expected packIssuesWithinOutputBudget to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorSdkError);
      expect(error).toMatchObject({
        code: "PROVIDER_ERROR",
        message: expect.stringMatching(/output size limit/i),
      });
      expect(String(error)).not.toMatch(/payload|x{10}/);
    }
  });
});

describe("assertStructuredOutputWithinBudget", () => {
  it("throws when serialized JSON exceeds the connector budget", () => {
    const oversized = { blob: "x".repeat(OUTPUT_MAX_STRUCTURED_JSON_BYTES) };
    expect(() => assertStructuredOutputWithinBudget(oversized)).toThrowError(
      ConnectorSdkError,
    );
  });
});

describe("github.repository.get regression", () => {
  it("does not leak secrets in size-limit errors", async () => {
    const client = createMockGithubClient({
      getRepository: async () => ({
        ...sampleRepository,
        html_url: `https://example.com/${TEST_GITHUB_TOKEN}/${"u".repeat(3000)}`,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools.find(
      (t) => t.name === GITHUB_REPOSITORY_GET_TOOL,
    )!;

    try {
      await tool.handler({ owner: "Osva-AI", repo: "osva" }, {});
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_ERROR" });
      expect(String(error)).not.toContain(TEST_GITHUB_TOKEN);
    }
    expect(client.getRepository).toHaveBeenCalledTimes(1);
  });
});
