import { vi } from "vitest";

import type {
  GithubRepositoryClient,
  GithubRepositoryRecord,
} from "../../src/github-client.js";

export const sampleRepository: GithubRepositoryRecord = {
  name: "osva",
  full_name: "Osva-AI/osva",
  description: "OSVA core repository",
  html_url: "https://github.com/Osva-AI/osva",
  visibility: "public",
  private: false,
  default_branch: "main",
  archived: false,
  fork: false,
};

export function createMockGithubClient(
  implementation?: Partial<GithubRepositoryClient>,
): GithubRepositoryClient & { getRepository: ReturnType<typeof vi.fn> } {
  const getRepository = vi.fn(
    implementation?.getRepository ?? (async () => sampleRepository),
  );

  return {
    getRepository,
  };
}
