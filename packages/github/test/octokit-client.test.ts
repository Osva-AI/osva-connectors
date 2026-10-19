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
});
