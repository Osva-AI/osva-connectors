import { GITHUB_TOKEN_ENV } from "../../src/constants.js";

export const TEST_GITHUB_TOKEN = "test_pat_osva_connector_github_0123456789";

export function withTestGithubEnv<T>(run: (env: NodeJS.ProcessEnv) => T): T {
  const env: NodeJS.ProcessEnv = {
    [GITHUB_TOKEN_ENV]: TEST_GITHUB_TOKEN,
  };
  return run(env);
}
