import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadSlackConfig } from "../src/config.js";
import {
  SLACK_ALLOWED_CHANNELS_ENV,
  SLACK_BOT_TOKEN_ENV,
  SLACK_WRITE_ENABLED_ENV,
} from "../src/constants.js";
import { MOCK_CHANNEL_PUBLIC } from "./fixtures/mock-slack-http-server.js";

describe("loadSlackConfig", () => {
  it("requires bot token", () => {
    expect(() => loadSlackConfig({})).toThrow(ConnectorSdkError);
    try {
      loadSlackConfig({});
    } catch (error) {
      expect(error).toMatchObject({ code: "CONFIGURATION_ERROR" });
    }
  });

  it("parses allowlist and write flag", () => {
    const config = loadSlackConfig({
      [SLACK_BOT_TOKEN_ENV]: "xoxb-test-token",
      [SLACK_ALLOWED_CHANNELS_ENV]: MOCK_CHANNEL_PUBLIC,
      [SLACK_WRITE_ENABLED_ENV]: "true",
    });
    expect(config.allowedChannelIds).toEqual([MOCK_CHANNEL_PUBLIC]);
    expect(config.writeEnabled).toBe(true);
  });

  it("rejects invalid allowlist channel IDs", () => {
    expect(() =>
      loadSlackConfig({
        [SLACK_BOT_TOKEN_ENV]: "xoxb-test",
        [SLACK_ALLOWED_CHANNELS_ENV]: "not-a-channel",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
