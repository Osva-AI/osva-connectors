import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";
import { parseGraphListResponse } from "./graph-pagination.js";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeOptionalText(value: unknown): {
  value?: string;
  truncated?: true;
} {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "string") {
    return {};
  }
  const { value: trimmed, truncated } = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return {
    value: trimmed,
    ...(truncated ? { truncated: true as const } : {}),
  };
}

function normalizeMessageBody(record: Record<string, unknown>): {
  contentType?: string;
  content?: string;
  contentTruncated?: true;
  untrustedContent: true;
} {
  const body = record.body;
  if (body === null || typeof body !== "object") {
    return { untrustedContent: true as const };
  }
  const b = body as Record<string, unknown>;
  const contentType = optionalString(b.contentType);
  const contentParts = normalizeOptionalText(b.content);
  return {
    ...(contentType !== undefined ? { contentType } : {}),
    ...(contentParts.value !== undefined
      ? { content: contentParts.value }
      : {}),
    ...(contentParts.truncated === true
      ? { contentTruncated: true as const }
      : {}),
    untrustedContent: true as const,
  };
}

export function normalizeTeamRecord(raw: unknown): {
  id: string;
  displayName?: string;
  description?: string;
  descriptionTruncated?: true;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected team.",
    );
  }
  const r = raw as Record<string, unknown>;
  const id = optionalString(r.id);
  if (id === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected team.",
    );
  }
  const displayName = optionalString(r.displayName);
  const desc = normalizeOptionalText(r.description);
  return {
    id,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(desc.value !== undefined ? { description: desc.value } : {}),
    ...(desc.truncated === true ? { descriptionTruncated: true as const } : {}),
    untrustedContent: true as const,
  };
}

export function normalizeChannelRecord(raw: unknown): {
  id: string;
  displayName?: string;
  description?: string;
  descriptionTruncated?: true;
  membershipType?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected channel.",
    );
  }
  const r = raw as Record<string, unknown>;
  const id = optionalString(r.id);
  if (id === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected channel.",
    );
  }
  const displayName = optionalString(r.displayName);
  const desc = normalizeOptionalText(r.description);
  const membershipType = optionalString(r.membershipType);
  return {
    id,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(desc.value !== undefined ? { description: desc.value } : {}),
    ...(desc.truncated === true ? { descriptionTruncated: true as const } : {}),
    ...(membershipType !== undefined ? { membershipType } : {}),
    untrustedContent: true as const,
  };
}

export function normalizeChatRecord(raw: unknown): {
  id: string;
  topic?: string;
  topicTruncated?: true;
  chatType?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected chat.",
    );
  }
  const r = raw as Record<string, unknown>;
  const id = optionalString(r.id);
  if (id === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected chat.",
    );
  }
  const topic = normalizeOptionalText(r.topic);
  const chatType = optionalString(r.chatType);
  return {
    id,
    ...(topic.value !== undefined ? { topic: topic.value } : {}),
    ...(topic.truncated === true ? { topicTruncated: true as const } : {}),
    ...(chatType !== undefined ? { chatType } : {}),
    untrustedContent: true as const,
  };
}

export function normalizeMessageRecord(raw: unknown): {
  id: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  from?: { displayName?: string; userId?: string };
  body?: { contentType?: string; content?: string; contentTruncated?: true };
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected message.",
    );
  }
  const r = raw as Record<string, unknown>;
  const id = optionalString(r.id);
  if (id === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected message.",
    );
  }
  const createdDateTime = optionalString(r.createdDateTime);
  const lastModifiedDateTime = optionalString(r.lastModifiedDateTime);
  const body = normalizeMessageBody(r);

  let from:
    | { displayName?: string; userId?: string; untrustedContent?: true }
    | undefined;
  const fromRaw = r.from;
  if (fromRaw !== null && typeof fromRaw === "object") {
    const f = fromRaw as Record<string, unknown>;
    const user = f.user;
    if (user !== null && typeof user === "object") {
      const u = user as Record<string, unknown>;
      const displayName = optionalString(u.displayName);
      const userId = optionalString(u.id);
      from = {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(userId !== undefined ? { userId } : {}),
        untrustedContent: true as const,
      };
    }
  }

  return {
    id,
    ...(createdDateTime !== undefined ? { createdDateTime } : {}),
    ...(lastModifiedDateTime !== undefined ? { lastModifiedDateTime } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(body.content !== undefined || body.contentType !== undefined
      ? {
          body: {
            ...(body.contentType !== undefined
              ? { contentType: body.contentType }
              : {}),
            ...(body.content !== undefined ? { content: body.content } : {}),
            ...(body.contentTruncated === true
              ? { contentTruncated: true as const }
              : {}),
          },
        }
      : {}),
    untrustedContent: true as const,
  };
}

export function mapTeamListResponse(
  raw: unknown,
  graphApiBase: string,
): {
  teams: ReturnType<typeof normalizeTeamRecord>[];
  nextLink?: string;
} {
  const parsed = parseGraphListResponse(raw, graphApiBase);
  const teams = parsed.value.map((item) => normalizeTeamRecord(item));
  return {
    teams,
    ...(parsed.nextLink !== undefined ? { nextLink: parsed.nextLink } : {}),
  };
}

export function mapChannelListResponse(
  raw: unknown,
  graphApiBase: string,
): {
  channels: ReturnType<typeof normalizeChannelRecord>[];
  nextLink?: string;
} {
  const parsed = parseGraphListResponse(raw, graphApiBase);
  const channels = parsed.value.map((item) => normalizeChannelRecord(item));
  return {
    channels,
    ...(parsed.nextLink !== undefined ? { nextLink: parsed.nextLink } : {}),
  };
}

export function mapMessageListResponse(
  raw: unknown,
  graphApiBase: string,
): {
  messages: ReturnType<typeof normalizeMessageRecord>[];
  nextLink?: string;
} {
  const parsed = parseGraphListResponse(raw, graphApiBase);
  const messages = parsed.value.map((item) => normalizeMessageRecord(item));
  return {
    messages,
    ...(parsed.nextLink !== undefined ? { nextLink: parsed.nextLink } : {}),
  };
}

export function mapChatListResponse(
  raw: unknown,
  graphApiBase: string,
): {
  chats: ReturnType<typeof normalizeChatRecord>[];
  nextLink?: string;
} {
  const parsed = parseGraphListResponse(raw, graphApiBase);
  const chats = parsed.value.map((item) => normalizeChatRecord(item));
  return {
    chats,
    ...(parsed.nextLink !== undefined ? { nextLink: parsed.nextLink } : {}),
  };
}

export function mapSendMessageResponse(raw: unknown): {
  id?: string;
  createdDateTime?: string;
  sent: true;
} {
  if (raw === null || typeof raw !== "object") {
    return { sent: true as const };
  }
  const r = raw as Record<string, unknown>;
  const id = optionalString(r.id);
  const createdDateTime = optionalString(r.createdDateTime);
  return {
    ...(id !== undefined ? { id } : {}),
    ...(createdDateTime !== undefined ? { createdDateTime } : {}),
    sent: true as const,
  };
}
