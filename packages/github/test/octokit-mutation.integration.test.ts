import { afterEach, describe, expect, it } from "vitest";

import {
  createGithubOctokit,
  createOctokitGithubClient,
} from "../src/octokit-client.js";
import {
  FAKE_GITHUB_PAT,
  startMockGithubHttpServer,
  type MockGithubHttpServer,
} from "./fixtures/mock-github-http-server.js";

describe("Octokit issue create mutation safety (loopback mock HTTP)", () => {
  let mockGithub: MockGithubHttpServer | undefined;

  afterEach(async () => {
    if (mockGithub !== undefined) {
      await mockGithub.close();
      mockGithub = undefined;
    }
  });

  function createConfiguredClient(): ReturnType<
    typeof createOctokitGithubClient
  > {
    if (mockGithub === undefined) {
      throw new Error("Mock GitHub server is not started.");
    }
    const octokit = createGithubOctokit({
      token: FAKE_GITHUB_PAT,
      baseUrl: mockGithub.apiBaseUrl,
    });
    return createOctokitGithubClient({
      token: FAKE_GITHUB_PAT,
      octokit,
    });
  }

  const createParams = {
    owner: "Osva-AI",
    repo: "osva",
    title: "Mutation safety probe",
  };

  it("issues exactly one POST when GitHub returns 500 (retry plugin active)", async () => {
    mockGithub = await startMockGithubHttpServer({ mode: "server_error" });
    const client = createConfiguredClient();

    await expect(client.createIssue(createParams)).rejects.toThrow();

    expect(mockGithub.getIssueCreateRequestCount()).toBe(1);
  });

  it("issues exactly one POST when GitHub returns a rate-limit response (throttling plugin active)", async () => {
    mockGithub = await startMockGithubHttpServer({ mode: "rate_limit" });
    const client = createConfiguredClient();

    await expect(client.createIssue(createParams)).rejects.toThrow();

    expect(mockGithub.getIssueCreateRequestCount()).toBe(1);
  });

  const commentParams = {
    owner: "Osva-AI",
    repo: "osva",
    issueNumber: 42,
    body: "Mutation safety comment probe",
  };

  it("issues exactly one comment POST when GitHub returns 500 (retry plugin active)", async () => {
    mockGithub = await startMockGithubHttpServer({ mode: "server_error" });
    const client = createConfiguredClient();

    await expect(client.createIssueComment(commentParams)).rejects.toThrow();

    expect(mockGithub.getIssueCommentCreateRequestCount()).toBe(1);
  });

  it("issues exactly one comment POST when GitHub returns a rate-limit response (throttling plugin active)", async () => {
    mockGithub = await startMockGithubHttpServer({ mode: "rate_limit" });
    const client = createConfiguredClient();

    await expect(client.createIssueComment(commentParams)).rejects.toThrow();

    expect(mockGithub.getIssueCommentCreateRequestCount()).toBe(1);
  });
});
