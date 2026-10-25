import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_MESSAGE_TEXT_LENGTH } from "./output-budget.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";
import type {
  SlackMessageRecord,
  SlackPaginatedMessages,
  SlackPostMessageResult,
} from "./slack-client.js";

function mapMessageRecord(raw: unknown): SlackMessageRecord {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack returned an unexpected message payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const ts = record.ts;
  if (typeof ts !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack returned an unexpected message payload.",
    );
  }
  const textRaw =
    typeof record.text === "string"
      ? record.text
      : typeof record.text === "undefined"
        ? ""
        : null;
  if (textRaw === null) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack returned an unexpected message payload.",
    );
  }
  const { value: text, truncated } = normalizeTruncatableProviderString(
    textRaw,
    OUTPUT_MAX_MESSAGE_TEXT_LENGTH,
  );

  const userId = typeof record.user === "string" ? record.user : undefined;
  const botId = typeof record.bot_id === "string" ? record.bot_id : undefined;
  const threadTs =
    typeof record.thread_ts === "string" ? record.thread_ts : undefined;
  const replyCount =
    typeof record.reply_count === "number" ? record.reply_count : undefined;

  return {
    ts,
    text,
    ...(truncated ? { textTruncated: true as const } : {}),
    ...(userId !== undefined ? { userId } : {}),
    ...(botId !== undefined ? { botId } : {}),
    ...(threadTs !== undefined ? { threadTs } : {}),
    ...(replyCount !== undefined ? { replyCount } : {}),
  };
}

export function mapMessageHistoryResponse(raw: {
  messages?: unknown;
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
}): Omit<SlackPaginatedMessages, "messagesTruncated"> {
  const messagesRaw = raw.messages;
  if (!Array.isArray(messagesRaw)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack returned an unexpected message list payload.",
    );
  }
  const messages = messagesRaw.map(mapMessageRecord);
  const nextCursorRaw = raw.response_metadata?.next_cursor;
  const nextCursor =
    typeof nextCursorRaw === "string" && nextCursorRaw.length > 0
      ? nextCursorRaw
      : undefined;
  const hasMore =
    raw.has_more === true ||
    (nextCursor !== undefined && nextCursor.length > 0);
  return {
    messages,
    ...(nextCursor !== undefined ? { nextCursor } : {}),
    hasMore,
  };
}

export function packMessagesWithinBudget(
  page: Omit<SlackPaginatedMessages, "messagesTruncated">,
): SlackPaginatedMessages {
  const packed = packListWithinOutputBudget(
    {
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      hasMore: page.hasMore,
    },
    "messages",
    page.messages,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapPostMessageResponse(raw: {
  channel?: unknown;
  ts?: unknown;
  message?: { ts?: unknown; thread_ts?: unknown };
}): SlackPostMessageResult {
  const channelId = raw.channel;
  const ts = raw.ts ?? raw.message?.ts;
  if (typeof channelId !== "string" || typeof ts !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack returned an unexpected postMessage payload.",
    );
  }
  const threadTs =
    typeof raw.message?.thread_ts === "string"
      ? raw.message.thread_ts
      : undefined;
  const result: SlackPostMessageResult = {
    channelId,
    ts,
    ...(threadTs !== undefined ? { threadTs } : {}),
  };
  assertStructuredOutputWithinBudget(result);
  return result;
}
