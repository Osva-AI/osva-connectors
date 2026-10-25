import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  SLACK_CHANNEL_ID_PATTERN,
  SLACK_MESSAGE_TS_PATTERN,
} from "./constants.js";

export function parseSlackChannelId(value: string): string {
  const trimmed = value.trim();
  if (!SLACK_CHANNEL_ID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Slack channel ID is not valid.",
    );
  }
  return trimmed;
}

export function parseSlackMessageTs(value: string): string {
  const trimmed = value.trim();
  if (!SLACK_MESSAGE_TS_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Slack message timestamp is not valid.",
    );
  }
  return trimmed;
}

export function assertChannelAllowed(
  channelId: string,
  allowedChannelIds: readonly string[] | undefined,
): void {
  if (allowedChannelIds === undefined || allowedChannelIds.length === 0) {
    return;
  }
  if (!allowedChannelIds.includes(channelId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "This channel is not in the configured allowlist.",
    );
  }
}
