import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { GITHUB_TOKEN_ENV } from "./constants.js";
import { githubConfigSchema, type GithubConfig } from "./schemas.js";

export function loadGithubConfig(
  env: NodeJS.ProcessEnv = process.env,
): GithubConfig {
  const rawToken = env[GITHUB_TOKEN_ENV];
  const parsed = githubConfigSchema.safeParse({
    token: rawToken ?? "",
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "GitHub connector token is not configured.",
    );
  }

  return parsed.data;
}
