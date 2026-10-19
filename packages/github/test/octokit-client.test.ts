import { Octokit } from "octokit";
import { describe, expect, it, vi } from "vitest";

import {
  createOctokitGithubClient,
  OSVA_MUTATION_NO_AUTO_RETRY,
} from "../src/octokit-client.js";
import { sampleIssue } from "./helpers/mock-github-client.js";

describe("createOctokitGithubClient", () => {
  it("passes no-retry mutation options to issues.create", async () => {
    const create = vi.fn(async () => ({
      data: sampleIssue,
      headers: {},
    }));
    const octokit = {
      rest: {
        issues: { create },
        repos: { get: vi.fn() },
      },
    } as unknown as Octokit;

    const client = createOctokitGithubClient({
      token: "test-token",
      octokit,
    });

    await client.createIssue({
      owner: "Osva-AI",
      repo: "osva",
      title: "Title",
      body: "Body",
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      owner: "Osva-AI",
      repo: "osva",
      title: "Title",
      body: "Body",
      request: expect.objectContaining({
        retries: 0,
        [OSVA_MUTATION_NO_AUTO_RETRY]: true,
        timeout: expect.any(Number),
      }),
    });
  });

  it("passes no-retry mutation options to issues.createComment", async () => {
    const createComment = vi.fn(async () => ({
      data: {
        id: 1,
        body: "x",
        html_url: "https://github.com/a/b/issues/1#issuecomment-1",
        created_at: "2024-01-01T00:00:00Z",
        user: { login: "u" },
      },
      headers: {},
    }));
    const octokit = {
      rest: {
        issues: { create: vi.fn(), createComment },
        repos: { get: vi.fn() },
      },
    } as unknown as Octokit;

    const client = createOctokitGithubClient({
      token: "test-token",
      octokit,
    });

    await client.createIssueComment({
      owner: "Osva-AI",
      repo: "osva",
      issueNumber: 42,
      body: "Body",
    });

    expect(createComment).toHaveBeenCalledTimes(1);
    expect(createComment).toHaveBeenCalledWith({
      owner: "Osva-AI",
      repo: "osva",
      issue_number: 42,
      body: "Body",
      request: expect.objectContaining({
        retries: 0,
        [OSVA_MUTATION_NO_AUTO_RETRY]: true,
        timeout: expect.any(Number),
      }),
    });
  });
});
