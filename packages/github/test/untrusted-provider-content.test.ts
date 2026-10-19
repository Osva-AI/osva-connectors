import { describe, expect, it, vi } from "vitest";

import {
  GITHUB_ISSUE_COMMENT_CREATE_TOOL,
  GITHUB_ISSUE_CREATE_TOOL,
  GITHUB_ISSUE_GET_TOOL,
  GITHUB_ISSUE_LIST_TOOL,
  ISSUE_CREATE_MAX_TITLE_LENGTH,
} from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import type {
  IssueCommentCreateOutput,
  IssueListOutput,
  NormalizedIssue,
} from "../src/issue-schemas.js";
import {
  hostileCommentBody,
  hostileIssueBody,
  hostileIssueTitle,
  longUnicodeIssueTitle,
  providerIssueWithHostileContent,
} from "./helpers/hostile-content-fixtures.js";
import {
  createMockGithubClient,
  sampleIssue,
  sampleIssueComment,
} from "./helpers/mock-github-client.js";

function getTool(
  connector: ReturnType<typeof createGithubConnector>,
  name: string,
) {
  const tool = connector.tools.find((t) => t.name === name);
  expect(tool).toBeDefined();
  return tool!;
}

describe("untrusted GitHub provider content (data path only)", () => {
  it("returns hostile issue fields verbatim on read without side effects", async () => {
    const hostile = providerIssueWithHostileContent();
    const client = createMockGithubClient({
      getIssue: async () => ({
        ...sampleIssue,
        title: hostile.title,
        body: hostile.body,
        labels: hostile.labels,
      }),
      listIssues: async () => ({
        items: [
          {
            ...sampleIssue,
            title: hostile.title,
            body: hostile.body,
            labels: hostile.labels,
          },
        ],
        page: 1,
        perPage: 20,
        hasNextPage: false,
      }),
    });
    const connector = createGithubConnector({ client });

    const getOutput = (await getTool(connector, GITHUB_ISSUE_GET_TOOL).handler(
      { owner: "Osva-AI", repo: "osva", issueNumber: 42 },
      {},
    )) as NormalizedIssue;
    expect(getOutput.title).toBe(hostile.title);
    expect(getOutput.labels[0]).toBe(hostile.labels[0]!.name.slice(0, 100));

    const listOutput = (await getTool(
      connector,
      GITHUB_ISSUE_LIST_TOOL,
    ).handler({ owner: "Osva-AI", repo: "osva" }, {})) as IssueListOutput;
    expect(listOutput.issues[0]?.title).toBe(hostile.title);

    expect(client.createIssue).not.toHaveBeenCalled();
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });

  it("forwards hostile create input to the provider as data without extra tool calls", async () => {
    const createIssue = vi.fn(async () => ({
      ...sampleIssue,
      title: hostileIssueTitle,
    }));
    const client = createMockGithubClient({ createIssue });
    const connector = createGithubConnector({ client });
    const tool = getTool(connector, GITHUB_ISSUE_CREATE_TOOL);

    await tool.handler(
      {
        owner: "Osva-AI",
        repo: "osva",
        title: hostileIssueTitle,
        body: hostileIssueBody,
      },
      {},
    );

    expect(createIssue).toHaveBeenCalledTimes(1);
    expect(createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: hostileIssueTitle,
        body: hostileIssueBody,
      }),
    );
    expect(client.getIssue).not.toHaveBeenCalled();
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });

  it("accepts long unicode create titles within input bounds", async () => {
    const title = longUnicodeIssueTitle.slice(0, ISSUE_CREATE_MAX_TITLE_LENGTH);
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = getTool(connector, GITHUB_ISSUE_CREATE_TOOL);

    await tool.handler(
      {
        owner: "Osva-AI",
        repo: "osva",
        title,
        body: hostileCommentBody,
      },
      {},
    );

    expect(client.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({ title, body: hostileCommentBody }),
    );
  });

  it("returns hostile comment bodies from provider normalization unchanged", async () => {
    const client = createMockGithubClient({
      createIssueComment: async () => ({
        ...sampleIssueComment,
        body: hostileCommentBody,
      }),
    });
    const connector = createGithubConnector({ client });
    const tool = getTool(connector, GITHUB_ISSUE_COMMENT_CREATE_TOOL);

    const output = (await tool.handler(
      {
        owner: "Osva-AI",
        repo: "osva",
        issueNumber: 42,
        body: "agent-authored comment",
      },
      {},
    )) as IssueCommentCreateOutput;

    expect(output.body).toBe(hostileCommentBody);
    expect(client.createIssueComment).toHaveBeenCalledTimes(1);
    expect(client.createIssue).not.toHaveBeenCalled();
  });
});
