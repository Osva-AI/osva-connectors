import { ConnectorSdkError } from "@osva-ai/connector-sdk";

function normalizeRepoKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

export function assertGithubRepositoryAllowed(
  owner: string,
  repo: string,
  allowedRepositories: readonly string[] | undefined,
): void {
  if (allowedRepositories === undefined || allowedRepositories.length === 0) {
    return;
  }
  const key = normalizeRepoKey(owner, repo);
  const permitted = new Set(
    allowedRepositories.map((entry) => entry.trim().toLowerCase()),
  );
  if (!permitted.has(key)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Repository is not in the allowed repository list.",
    );
  }
}
