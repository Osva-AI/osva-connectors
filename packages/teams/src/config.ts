import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  GRAPH_API_HOST,
  TEAMS_ACCESS_TOKEN_ENV,
  TEAMS_ALLOWED_CHANNEL_DESTINATIONS_ENV,
  TEAMS_ALLOWED_CHANNEL_IDS_ENV,
  TEAMS_ALLOWED_CHAT_DESTINATIONS_ENV,
  TEAMS_ALLOWED_CHAT_IDS_ENV,
  TEAMS_ALLOWED_TEAM_IDS_ENV,
  TEAMS_HOST_SEND_APPROVED_ENV,
  TEAMS_SEND_ENABLED_ENV,
  TEAMS_TIMEOUT_MS_ENV,
} from "./constants.js";
import { teamsConfigSchema, type TeamsConfig } from "./schemas.js";
import {
  parseChannelDestinationPair,
  parseGraphResourceId,
  parseTeamId,
} from "./teams-id.js";

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

function parseBooleanFlag(raw: string | undefined, fallback: false): boolean {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
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
    "Boolean environment flag must be true or false.",
  );
}

/**
 * `undefined` — env var absent: no allowlist (all ids allowed for reads).
 * `[]` — env var present but empty/whitespace-only: explicit deny-all allowlist.
 */
function parseTriStateIdList(
  raw: string | undefined,
  label: string,
  parseId: (value: string) => string,
): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const id = parseId(part);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parseChannelDestinations(
  raw: string | undefined,
): TeamsConfig["allowedChannelDestinations"] {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const out: NonNullable<TeamsConfig["allowedChannelDestinations"]> = [];
  for (const part of parts) {
    const parsed = parseChannelDestinationPair(
      part,
      "channel destination entry",
    );
    const key = `${parsed.teamId}:${parsed.channelId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(parsed);
  }
  return out;
}

function parseChatDestinations(raw: string | undefined): string[] | undefined {
  return parseTriStateIdList(raw, "chat destination", (v) =>
    parseGraphResourceId(v, "chat ID"),
  );
}

export function loadTeamsConfig(
  env: NodeJS.ProcessEnv = process.env,
): TeamsConfig {
  const accessTokenRaw = env[TEAMS_ACCESS_TOKEN_ENV];
  if (accessTokenRaw === undefined || accessTokenRaw.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "OSVA_CONNECTOR_TEAMS_ACCESS_TOKEN is required (delegated user OAuth token from the host).",
    );
  }
  const accessToken = accessTokenRaw.trim();

  const requestTimeoutMs = readBoundedInt(
    env[TEAMS_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const sendEnabled = parseBooleanFlag(env[TEAMS_SEND_ENABLED_ENV], false);
  const hostSendApproved = parseBooleanFlag(
    env[TEAMS_HOST_SEND_APPROVED_ENV],
    false,
  );

  const allowedTeamIds = parseTriStateIdList(
    env[TEAMS_ALLOWED_TEAM_IDS_ENV],
    "team ID",
    parseTeamId,
  );
  const allowedChannelIds = parseTriStateIdList(
    env[TEAMS_ALLOWED_CHANNEL_IDS_ENV],
    "channel ID",
    (v) => parseGraphResourceId(v, "channel ID"),
  );
  const allowedChatIds = parseTriStateIdList(
    env[TEAMS_ALLOWED_CHAT_IDS_ENV],
    "chat ID",
    (v) => parseGraphResourceId(v, "chat ID"),
  );

  const allowedChannelDestinations = parseChannelDestinations(
    env[TEAMS_ALLOWED_CHANNEL_DESTINATIONS_ENV],
  );
  const allowedChatDestinations = parseChatDestinations(
    env[TEAMS_ALLOWED_CHAT_DESTINATIONS_ENV],
  );

  const parsed = teamsConfigSchema.safeParse({
    accessToken,
    requestTimeoutMs,
    sendEnabled,
    hostSendApproved,
    allowedTeamIds,
    allowedChannelIds,
    allowedChatIds,
    allowedChannelDestinations,
    allowedChatDestinations,
    graphApiBase: GRAPH_API_HOST,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Teams connector configuration is invalid.",
    );
  }

  if (parsed.data.sendEnabled) {
    const channelOk =
      parsed.data.allowedChannelDestinations !== undefined &&
      parsed.data.allowedChannelDestinations.length > 0;
    const chatOk =
      parsed.data.allowedChatDestinations !== undefined &&
      parsed.data.allowedChatDestinations.length > 0;
    if (!channelOk || !chatOk) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Send enablement requires non-empty OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_DESTINATIONS and OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_DESTINATIONS.",
      );
    }
  }

  return parsed.data;
}
