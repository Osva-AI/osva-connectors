import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapGithubError } from "../src/map-github-error.js";
import { createGithubRequestError } from "./helpers/request-error.js";
import { TEST_GITHUB_TOKEN } from "./helpers/test-env.js";

describe("mapGithubError", () => {
  it("maps GitHub 401 responses", () => {
    const error = mapGithubError(
      createGithubRequestError(401, "Bad credentials"),
    );
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).not.toContain("Bad credentials");
  });

  it("maps GitHub 403 responses", () => {
    const error = mapGithubError(createGithubRequestError(403, "Forbidden"));
    expect(error.code).toBe("FORBIDDEN");
  });

  it("maps GitHub 403 rate-limit responses using response headers", () => {
    const error = mapGithubError(
      createGithubRequestError(403, "Forbidden", {
        "x-ratelimit-remaining": "0",
      }),
    );
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
    expect(error.message).not.toContain("Forbidden");
  });

  it("maps GitHub 403 secondary limits when Retry-After is present", () => {
    const error = mapGithubError(
      createGithubRequestError(403, "Forbidden", {
        "retry-after": "60",
      }),
    );
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("maps GitHub 404 responses", () => {
    const error = mapGithubError(createGithubRequestError(404, "Not Found"));
    expect(error.code).toBe("NOT_FOUND");
  });

  it("maps GitHub 422 responses", () => {
    const error = mapGithubError(
      createGithubRequestError(422, "Validation Failed"),
    );
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.message).not.toContain("Validation Failed");
  });

  it("uses ambiguous write messaging for mutation timeouts", () => {
    const timeout = new Error("Timed out");
    timeout.name = "TimeoutError";
    const error = mapGithubError(timeout, { ambiguousWrite: true });
    expect(error.code).toBe("TIMEOUT");
    expect(error.retryable).toBe(false);
    expect(error.message).toMatch(/may still have been applied/i);
  });

  it("uses ambiguous write messaging for mutation 5xx errors", () => {
    const error = mapGithubError(
      createGithubRequestError(500, "Internal Server Error"),
      { ambiguousWrite: true },
    );
    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.retryable).toBe(false);
    expect(error.message).toMatch(/may still have been applied/i);
  });

  it("does not mark mutation rate limits as retryable", () => {
    const error = mapGithubError(
      createGithubRequestError(403, "Forbidden", {
        "x-ratelimit-remaining": "0",
      }),
      { ambiguousWrite: true },
    );
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(false);
    expect(error.message).toMatch(/may still have been applied/i);
  });

  it("maps GitHub 429 responses as retryable rate limits", () => {
    const error = mapGithubError(createGithubRequestError(429, "Rate limit"));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  it("maps abort errors to cancellation", () => {
    const error = mapGithubError(new DOMException("Aborted", "AbortError"));
    expect(error.code).toBe("CANCELLED");
  });

  it("maps timeout errors", () => {
    const timeout = new Error("Timed out");
    timeout.name = "TimeoutError";
    const error = mapGithubError(timeout);
    expect(error.code).toBe("TIMEOUT");
    expect(error.retryable).toBe(true);
  });

  it("sanitizes unexpected provider exceptions", () => {
    const sensitive = new Error(`upstream failed token=${TEST_GITHUB_TOKEN}`);
    const error = mapGithubError(sensitive);
    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).not.toContain(TEST_GITHUB_TOKEN);
  });

  it("passes through ConnectorSdkError instances", () => {
    const original = new ConnectorSdkError("INVALID_INPUT", "Invalid input.");
    expect(mapGithubError(original)).toBe(original);
  });
});
