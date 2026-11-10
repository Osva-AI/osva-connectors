import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GITHUB_ALLOWED_REPOSITORIES_ENV,
  GITHUB_TOKEN_ENV,
} from "./constants.js";
import { githubConfigSchema, type GithubConfig } from "./schemas.js";

function parseAllowedRepositories(
  raw: string | undefined,
): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const entries = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (entries.length === 0) {
    return undefined;
  }
  return entries;
}

export function loadGithubConfig(
  env: NodeJS.ProcessEnv = process.env,
): GithubConfig {
  const rawToken = env[GITHUB_TOKEN_ENV];
  const parsed = githubConfigSchema.safeParse({
    token: rawToken ?? "",
    allowedRepositories: parseAllowedRepositories(
      env[GITHUB_ALLOWED_REPOSITORIES_ENV],
    ),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "GitHub connector token is not configured.",
    );
  }

  return parsed.data;
}
