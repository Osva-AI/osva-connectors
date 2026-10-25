import { createSlackRestClient } from "../../src/index.js";
import {
  FAKE_SLACK_BOT_TOKEN,
  type MockSlackHttpServer,
} from "../fixtures/mock-slack-http-server.js";

export function createTestSlackClient(
  server: MockSlackHttpServer,
  options?: { allowedChannelIds?: readonly string[] },
) {
  return createSlackRestClient({
    botToken: FAKE_SLACK_BOT_TOKEN,
    requestTimeoutMs: 5_000,
    apiBaseUrl: server.apiBaseUrl,
    ...(options?.allowedChannelIds !== undefined
      ? { allowedChannelIds: options.allowedChannelIds }
      : {}),
  });
}

export function createTestSlackConfig(
  overrides?: Partial<{
    writeEnabled: boolean;
    allowedChannelIds: string[];
  }>,
) {
  return {
    botToken: FAKE_SLACK_BOT_TOKEN,
    requestTimeoutMs: 5_000,
    writeEnabled: overrides?.writeEnabled ?? false,
    allowedChannelIds: overrides?.allowedChannelIds,
  };
}
