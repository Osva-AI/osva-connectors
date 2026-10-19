import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it, vi } from "vitest";

import {
  CONNECTOR_KEY,
  CONNECTOR_VERSION,
  GITHUB_REPOSITORY_GET_TOOL,
} from "../src/constants.js";
import { createGithubConnector } from "../src/connector.js";
import type { GithubRepositoryRecord } from "../src/github-client.js";
import { repositoryGetInputJsonSchema } from "../src/schemas.js";
import {
  createMockGithubClient,
  sampleRepository,
} from "./helpers/mock-github-client.js";
import { createGithubRequestError } from "./helpers/request-error.js";
import { TEST_GITHUB_TOKEN } from "./helpers/test-env.js";

describe("createGithubConnector", () => {
  it("exposes connector metadata and registers the repository tool", () => {
    const connector = createGithubConnector({
      client: createMockGithubClient(),
    });

    expect(connector.metadata.key).toBe(CONNECTOR_KEY);
    expect(connector.metadata.version).toBe(CONNECTOR_VERSION);
    expect(connector.tools).toHaveLength(5);
    expect(connector.tools[0]?.name).toBe(GITHUB_REPOSITORY_GET_TOOL);
  });

  it("uses a deterministic input schema", () => {
    const connector = createGithubConnector({
      client: createMockGithubClient(),
    });
    expect(connector.tools[0]?.inputSchema).toEqual(
      repositoryGetInputJsonSchema,
    );
  });
});

describe("github.repository.get handler", () => {
  it("returns a restricted repository payload on success", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = connector.tools[0];
    expect(tool).toBeDefined();

    const output = await tool!.handler({ owner: "Osva-AI", repo: "osva" }, {});

    expect(output).toEqual({
      name: sampleRepository.name,
      fullName: sampleRepository.full_name,
      description: sampleRepository.description,
      htmlUrl: sampleRepository.html_url,
      visibility: "public",
      defaultBranch: sampleRepository.default_branch,
      archived: false,
      fork: false,
    });
    expect(output).not.toHaveProperty("id");
    expect(client.getRepository).toHaveBeenCalledWith({
      owner: "Osva-AI",
      repo: "osva",
      signal: undefined,
    });
  });

  it("rejects invalid input before contacting GitHub", async () => {
    const client = createMockGithubClient();
    const connector = createGithubConnector({ client });
    const tool = connector.tools[0]!;

    await expect(
      tool.handler({ owner: "", repo: "osva" }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.getRepository).not.toHaveBeenCalled();
  });

  it("maps missing repositories to NOT_FOUND", async () => {
    const client = createMockGithubClient({
      getRepository: async () => {
        throw createGithubRequestError(404, "Not Found");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools[0]!;

    await expect(
      tool.handler({ owner: "missing", repo: "repo" }, {}),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("propagates cancellation via AbortSignal", async () => {
    const client = createMockGithubClient({
      getRepository: async ({ signal }) => {
        await new Promise<GithubRepositoryRecord>((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
        return sampleRepository;
      },
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools[0]!;
    const controller = new AbortController();

    const pending = tool.handler(
      { owner: "Osva-AI", repo: "osva" },
      { signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("does not leak credentials in sanitized tool errors", async () => {
    const client = createMockGithubClient({
      getRepository: async () => {
        throw new Error(`secret ${TEST_GITHUB_TOKEN}`);
      },
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools[0]!;

    try {
      await tool.handler({ owner: "Osva-AI", repo: "osva" }, {});
      expect.fail("Expected handler to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_ERROR" });
      expect(String(error)).not.toContain(TEST_GITHUB_TOKEN);
    }
  });

  it("does not call the provider when slug validation fails", async () => {
    const client = createMockGithubClient();
    client.getRepository = vi.fn(async () => sampleRepository);
    const connector = createGithubConnector({ client });
    const tool = connector.tools[0]!;

    await expect(
      tool.handler({ owner: "-bad-", repo: "osva" }, {}),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(client.getRepository).not.toHaveBeenCalled();
  });

  it("maps authentication failures", async () => {
    const client = createMockGithubClient({
      getRepository: async () => {
        throw createGithubRequestError(401, "Bad credentials");
      },
    });
    const connector = createGithubConnector({ client });
    const tool = connector.tools[0]!;

    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva" }, {}),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
    await expect(
      tool.handler({ owner: "Osva-AI", repo: "osva" }, {}),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
