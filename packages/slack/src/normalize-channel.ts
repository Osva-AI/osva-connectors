import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type {
  SlackChannelInfo,
  SlackChannelSummary,
  SlackPaginatedChannels,
} from "./slack-client.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";

function mapChannelSummary(raw: unknown): SlackChannelSummary {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack returned an unexpected channel payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const id = record.id;
  const name = record.name;
  if (typeof id !== "string" || typeof name !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack returned an unexpected channel payload.",
    );
  }
  const isPrivate = record.is_private === true;
  const isArchived = record.is_archived === true;
  return { id, name, isPrivate, isArchived };
}

export function mapChannelListResponse(raw: {
  channels?: unknown;
  response_metadata?: { next_cursor?: string };
}): Omit<SlackPaginatedChannels, "allowlistFiltered" | "channelsTruncated"> {
  const channelsRaw = raw.channels;
  if (!Array.isArray(channelsRaw)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack returned an unexpected channel list payload.",
    );
  }
  const channels = channelsRaw.map(mapChannelSummary);
  const nextCursorRaw = raw.response_metadata?.next_cursor;
  const nextCursor =
    typeof nextCursorRaw === "string" && nextCursorRaw.length > 0
      ? nextCursorRaw
      : undefined;
  const hasMore = nextCursor !== undefined;
  return {
    channels,
    ...(nextCursor !== undefined ? { nextCursor } : {}),
    hasMore,
  };
}

export function mapChannelInfoResponse(raw: {
  channel?: unknown;
}): SlackChannelInfo {
  const summary = mapChannelSummary(raw.channel);
  const channel =
    raw.channel !== null && typeof raw.channel === "object"
      ? (raw.channel as Record<string, unknown>)
      : {};
  let topic: string | undefined;
  let purpose: string | undefined;
  if (
    channel.topic !== null &&
    typeof channel.topic === "object" &&
    typeof (channel.topic as { value?: unknown }).value === "string"
  ) {
    topic = (channel.topic as { value: string }).value;
  }
  if (
    channel.purpose !== null &&
    typeof channel.purpose === "object" &&
    typeof (channel.purpose as { value?: unknown }).value === "string"
  ) {
    purpose = (channel.purpose as { value: string }).value;
  }
  const memberCount =
    typeof channel.num_members === "number" ? channel.num_members : undefined;
  return {
    ...summary,
    ...(topic !== undefined ? { topic } : {}),
    ...(purpose !== undefined ? { purpose } : {}),
    ...(memberCount !== undefined ? { memberCount } : {}),
  };
}

export function filterChannelsByAllowlist(
  page: Omit<SlackPaginatedChannels, "allowlistFiltered" | "channelsTruncated">,
  allowedChannelIds: readonly string[] | undefined,
): SlackPaginatedChannels {
  if (allowedChannelIds === undefined || allowedChannelIds.length === 0) {
    const packed = packListWithinOutputBudget(
      {
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
      "channels",
      page.channels,
    );
    assertStructuredOutputWithinBudget(packed);
    return packed;
  }

  const allowed = new Set(allowedChannelIds);
  const filtered = page.channels.filter((channel) => allowed.has(channel.id));
  const packed = packListWithinOutputBudget(
    {
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      allowlistFiltered: true as const,
    },
    "channels",
    filtered,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
