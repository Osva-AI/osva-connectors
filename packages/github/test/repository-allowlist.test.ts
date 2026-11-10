import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { assertGithubRepositoryAllowed } from "../src/repository-allowlist.js";

describe("assertGithubRepositoryAllowed", () => {
  it("allows any repo when allowlist is unset", () => {
    expect(() =>
      assertGithubRepositoryAllowed("octo", "hello", undefined),
    ).not.toThrow();
  });

  it("rejects repositories outside the allowlist", () => {
    expect(() =>
      assertGithubRepositoryAllowed("evil", "repo", ["octo/hello"]),
    ).toThrow(ConnectorSdkError);
  });

  it("matches owner/repo case-insensitively", () => {
    expect(() =>
      assertGithubRepositoryAllowed("Octo", "Hello", ["octo/hello"]),
    ).not.toThrow();
  });
});
