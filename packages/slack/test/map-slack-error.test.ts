import { describe, expect, it } from "vitest";

import { mapSlackError } from "../src/map-slack-error.js";
import type { SlackHttpError } from "../src/slack-rest-client.js";
import { FAKE_SLACK_BOT_TOKEN } from "./fixtures/mock-slack-http-server.js";

describe("mapSlackError", () => {
  it("maps invalid_auth to UNAUTHORIZED", () => {
    const error: SlackHttpError = {
      kind: "slack_api",
      slackError: "invalid_auth",
    };
    expect(mapSlackError(error).code).toBe("UNAUTHORIZED");
  });

  it("maps read rate limits as retryable", () => {
    const error: SlackHttpError = {
      kind: "slack_api",
      slackError: "ratelimited",
    };
    const mapped = mapSlackError(error);
    expect(mapped.code).toBe("RATE_LIMITED");
    expect(mapped.retryable).toBe(true);
  });

  it("does not mark ambiguous write failures as retryable", () => {
    const timeout = new Error("Slack request timed out.");
    timeout.name = "TimeoutError";
    const mapped = mapSlackError(timeout, { ambiguousWrite: true });
    expect(mapped).toMatchObject({
      code: "TIMEOUT",
      retryable: false,
    });
  });

  it("redacts bot tokens from error messages", () => {
    const error = new Error(`Slack failed with ${FAKE_SLACK_BOT_TOKEN}`);
    const mapped = mapSlackError(error, { botToken: FAKE_SLACK_BOT_TOKEN });
    expect(mapped.message).not.toContain(FAKE_SLACK_BOT_TOKEN);
  });
});
