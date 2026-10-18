import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadGithubConfig } from "../src/config.js";
import { GITHUB_TOKEN_ENV } from "../src/constants.js";
import { TEST_GITHUB_TOKEN, withTestGithubEnv } from "./helpers/test-env.js";

describe("loadGithubConfig", () => {
  it("loads a valid token from the documented environment variable", () => {
    const config = withTestGithubEnv((env) => loadGithubConfig(env));
    expect(config.token).toBe(TEST_GITHUB_TOKEN);
  });

  it("rejects missing configuration", () => {
    expect(() => loadGithubConfig({})).toThrow(ConnectorSdkError);
    try {
      loadGithubConfig({});
    } catch (error) {
      expect(error).toMatchObject({
        code: "CONFIGURATION_ERROR",
      });
    }
  });

  it("rejects blank configuration without echoing secrets", () => {
    try {
      loadGithubConfig({ [GITHUB_TOKEN_ENV]: "   " });
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorSdkError);
      expect((error as ConnectorSdkError).message).not.toContain("   ");
    }
  });
});
