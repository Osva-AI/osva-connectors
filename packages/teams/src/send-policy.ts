import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_MESSAGE_CONTENT_BYTES } from "./constants.js";
import type { TeamsConfig } from "./schemas.js";
import { channelDestinationKey } from "./teams-id.js";

export function assertSendEnabledAndApproved(config: TeamsConfig): void {
  if (!config.sendEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Teams sending is disabled. Set OSVA_CONNECTOR_TEAMS_SEND_ENABLED=true after host policy review.",
    );
  }
  if (!config.hostSendApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Teams message send requires explicit host approval. Set OSVA_CONNECTOR_TEAMS_HOST_SEND_APPROVED=true only after workflow sign-off.",
    );
  }
}

export function assertChannelDestinationAllowed(
  teamId: string,
  channelId: string,
  config: TeamsConfig,
): void {
  const destinations = config.allowedChannelDestinations;
  if (destinations === undefined || destinations.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Channel sends require a non-empty OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_DESTINATIONS allowlist.",
    );
  }
  const key = channelDestinationKey(teamId, channelId);
  const allowed = new Set(
    destinations.map((d) => channelDestinationKey(d.teamId, d.channelId)),
  );
  if (!allowed.has(key)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Channel destination is not on the host-configured allowlist.",
    );
  }
}

export function assertChatDestinationAllowed(
  chatId: string,
  config: TeamsConfig,
): void {
  const destinations = config.allowedChatDestinations;
  if (destinations === undefined || destinations.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Chat sends require a non-empty OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_DESTINATIONS allowlist.",
    );
  }
  const allowed = new Set(destinations);
  if (!allowed.has(chatId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Chat destination is not on the host-configured allowlist.",
    );
  }
}

export function buildGraphMessageBody(parts: {
  readonly content: string;
  readonly contentType: "text" | "html";
}): { body: { content: string; contentType: "text" | "html" } } {
  const trimmed = parts.content.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Message content must not be empty.",
    );
  }
  if (Buffer.byteLength(trimmed, "utf8") > MAX_MESSAGE_CONTENT_BYTES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Message content exceeds the connector size limit.",
    );
  }
  if (/[\0\x0B\x0C]/.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Message content contains invalid characters.",
    );
  }
  return {
    body: {
      content: trimmed,
      contentType: parts.contentType,
    },
  };
}
