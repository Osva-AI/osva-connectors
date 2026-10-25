import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  SLACK_ALLOWED_CHANNELS_ENV,
  SLACK_BOT_TOKEN_ENV,
  SLACK_TIMEOUT_MS_ENV,
  SLACK_WRITE_ENABLED_ENV,
  SLACK_CHANNEL_ID_PATTERN,
} from "./constants.js";
import { slackConfigSchema, type SlackConfig } from "./schemas.js";

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be an integer.`,
    );
  }
  return value;
}

function parseAllowedChannels(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  for (const id of parts) {
    if (!SLACK_CHANNEL_ID_PATTERN.test(id)) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Allowed channel list contains an invalid Slack channel ID.",
      );
    }
  }
  return parts;
}

function parseWriteEnabled(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim().length === 0) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Write enable flag must be true or false.",
  );
}

export function loadSlackConfig(
  env: NodeJS.ProcessEnv = process.env,
): SlackConfig {
  const rawToken = env[SLACK_BOT_TOKEN_ENV];
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Slack bot token is not configured.",
    );
  }

  const requestTimeoutMs = readBoundedInt(
    env[SLACK_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const allowedChannelIds = parseAllowedChannels(
    env[SLACK_ALLOWED_CHANNELS_ENV],
  );
  const writeEnabled = parseWriteEnabled(env[SLACK_WRITE_ENABLED_ENV]);

  const parsed = slackConfigSchema.safeParse({
    botToken: rawToken.trim(),
    requestTimeoutMs,
    allowedChannelIds,
    writeEnabled,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Slack connector configuration is invalid.",
    );
  }

  return parsed.data;
}
