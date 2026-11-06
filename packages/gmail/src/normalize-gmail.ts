import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  truncateUnicodeByCodePoints,
} from "./output-budget.js";

const MAX_SNIPPET_DISPLAY = 2_048;
const MAX_BODY_DISPLAY = 32_768;

export function mapProfileResponse(raw: unknown): {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected profile.",
    );
  }
  const r = raw as Record<string, unknown>;
  const email = requireString(r.emailAddress, "emailAddress");
  const messagesTotal = requireFiniteInt(r.messagesTotal, "messagesTotal");
  const threadsTotal = requireFiniteInt(r.threadsTotal, "threadsTotal");
  const historyId = requireString(r.historyId, "historyId");
  return { emailAddress: email, messagesTotal, threadsTotal, historyId };
}

export function mapMessageListResponse(raw: unknown): {
  messages: { id: string; threadId?: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected message list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const messagesRaw = r.messages;
  const out: { id: string; threadId?: string }[] = [];
  if (Array.isArray(messagesRaw)) {
    for (const item of messagesRaw) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const m = item as Record<string, unknown>;
      const id = optionalString(m.id);
      if (id !== undefined) {
        const entry: { id: string; threadId?: string } = { id };
        const threadId = optionalString(m.threadId);
        if (threadId !== undefined) {
          entry.threadId = threadId;
        }
        out.push(entry);
      }
    }
  }
  const nextPageToken = optionalString(r.nextPageToken);
  const resultSizeEstimate = optionalFiniteInt(r.resultSizeEstimate);
  return {
    messages: out,
    ...(nextPageToken !== undefined ? { nextPageToken } : {}),
    ...(resultSizeEstimate !== undefined ? { resultSizeEstimate } : {}),
    untrustedContent: true as const,
  };
}

export function mapThreadListResponse(raw: unknown): {
  threads: { id: string; snippet?: string; historyId?: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected thread list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const threadsRaw = r.threads;
  const out: { id: string; snippet?: string; historyId?: string }[] = [];
  if (Array.isArray(threadsRaw)) {
    for (const item of threadsRaw) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const t = item as Record<string, unknown>;
      const id = optionalString(t.id);
      if (id === undefined) {
        continue;
      }
      const entry: { id: string; snippet?: string; historyId?: string } = {
        id,
      };
      const snippet = redactOptionalLongString(t.snippet, MAX_SNIPPET_DISPLAY);
      if (snippet !== undefined) {
        entry.snippet = snippet;
      }
      const historyId = optionalString(t.historyId);
      if (historyId !== undefined) {
        entry.historyId = historyId;
      }
      out.push(entry);
    }
  }
  const nextPageToken = optionalString(r.nextPageToken);
  const resultSizeEstimate = optionalFiniteInt(r.resultSizeEstimate);
  return {
    threads: out,
    ...(nextPageToken !== undefined ? { nextPageToken } : {}),
    ...(resultSizeEstimate !== undefined ? { resultSizeEstimate } : {}),
    untrustedContent: true as const,
  };
}

export function mapLabelsResponse(raw: unknown): {
  labels: {
    id: string;
    name?: string;
    type?: string;
    messagesTotal?: number;
    messagesUnread?: number;
  }[];
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected labels list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const labelsRaw = r.labels;
  const labels: {
    id: string;
    name?: string;
    type?: string;
    messagesTotal?: number;
    messagesUnread?: number;
  }[] = [];
  if (Array.isArray(labelsRaw)) {
    for (const item of labelsRaw) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const l = item as Record<string, unknown>;
      const id = optionalString(l.id);
      if (id === undefined) {
        continue;
      }
      const entry: {
        id: string;
        name?: string;
        type?: string;
        messagesTotal?: number;
        messagesUnread?: number;
      } = { id };
      const name = optionalString(l.name);
      if (name !== undefined) {
        entry.name = name;
      }
      const type = optionalString(l.type);
      if (type !== undefined) {
        entry.type = type;
      }
      const messagesTotal = optionalFiniteInt(l.messagesTotal);
      if (messagesTotal !== undefined) {
        entry.messagesTotal = messagesTotal;
      }
      const messagesUnread = optionalFiniteInt(l.messagesUnread);
      if (messagesUnread !== undefined) {
        entry.messagesUnread = messagesUnread;
      }
      labels.push(entry);
    }
  }
  return { labels, untrustedContent: true as const };
}

export function mapDraftListResponse(raw: unknown): {
  drafts: { id: string; message: { id: string; threadId?: string } }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected drafts list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const draftsRaw = r.drafts;
  const drafts: { id: string; message: { id: string; threadId?: string } }[] =
    [];
  if (Array.isArray(draftsRaw)) {
    for (const item of draftsRaw) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const d = item as Record<string, unknown>;
      const id = optionalString(d.id);
      const msg = d.message;
      if (id === undefined || msg === null || typeof msg !== "object") {
        continue;
      }
      const mr = msg as Record<string, unknown>;
      const mid = optionalString(mr.id);
      if (mid === undefined) {
        continue;
      }
      const message: { id: string; threadId?: string } = { id: mid };
      const threadId = optionalString(mr.threadId);
      if (threadId !== undefined) {
        message.threadId = threadId;
      }
      drafts.push({ id, message });
    }
  }
  const nextPageToken = optionalString(r.nextPageToken);
  const resultSizeEstimate = optionalFiniteInt(r.resultSizeEstimate);
  return {
    drafts,
    ...(nextPageToken !== undefined ? { nextPageToken } : {}),
    ...(resultSizeEstimate !== undefined ? { resultSizeEstimate } : {}),
    untrustedContent: true as const,
  };
}

export function mapMessageGetResponse(
  raw: unknown,
  options: { readonly format: "minimal" | "metadata" | "full" },
): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected message.",
    );
  }
  const r = raw as Record<string, unknown>;
  const id = requireString(r.id, "id");
  const threadId = optionalString(r.threadId);
  const labelIds = optionalStringArray(r.labelIds);
  const snippet = redactOptionalLongString(r.snippet, MAX_SNIPPET_DISPLAY);
  const sizeEstimate = optionalFiniteInt(r.sizeEstimate);

  const base: Record<string, unknown> = {
    id,
    format: options.format,
    untrustedContent: true as const,
  };
  if (threadId !== undefined) {
    base.threadId = threadId;
  }
  if (labelIds !== undefined) {
    base.labelIds = labelIds;
  }
  if (snippet !== undefined) {
    base.snippet = snippet;
  }
  if (sizeEstimate !== undefined) {
    base.sizeEstimate = sizeEstimate;
  }

  if (options.format === "minimal") {
    return base;
  }

  const headers = extractHeadersMap(r.payload);
  if (Object.keys(headers).length > 0) {
    base.headers = headers;
  }

  if (options.format === "full") {
    const body = extractPlainTextBody(r.payload);
    if (body !== undefined) {
      const t = truncateUnicodeByCodePoints(body, MAX_BODY_DISPLAY);
      base.bodyPlain = t.value;
      if (t.truncated) {
        base.bodyPlainTruncated = true as const;
      }
    }
  }

  return base;
}

export function mapThreadGetResponse(
  raw: unknown,
  options: { readonly format: "minimal" | "metadata" | "full" },
): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected thread.",
    );
  }
  const r = raw as Record<string, unknown>;
  const id = requireString(r.id, "id");
  const historyId = optionalString(r.historyId);
  const snippet = redactOptionalLongString(r.snippet, MAX_SNIPPET_DISPLAY);
  const messagesRaw = r.messages;

  const base: Record<string, unknown> = {
    id,
    format: options.format,
    untrustedContent: true as const,
  };
  if (historyId !== undefined) {
    base.historyId = historyId;
  }
  if (snippet !== undefined) {
    base.snippet = snippet;
  }

  if (Array.isArray(messagesRaw)) {
    const summaries: unknown[] = [];
    for (const m of messagesRaw) {
      summaries.push(mapMessageGetResponse(m, options));
    }
    base.messages = summaries;
  }

  return base;
}

export function mapDraftCreateOrUpdateResponse(raw: unknown): {
  draftId: string;
  messageId?: string;
  threadId?: string;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected draft response.",
    );
  }
  const r = raw as Record<string, unknown>;
  const draftId = optionalString(r.id);
  if (draftId === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected draft response.",
    );
  }
  const out: {
    draftId: string;
    messageId?: string;
    threadId?: string;
  } = { draftId };
  const message = r.message;
  if (message !== null && typeof message === "object") {
    const mr = message as Record<string, unknown>;
    const messageId = optionalString(mr.id);
    if (messageId !== undefined) {
      out.messageId = messageId;
    }
    const threadId = optionalString(mr.threadId);
    if (threadId !== undefined) {
      out.threadId = threadId;
    }
  }
  return out;
}

export function mapSendMessageResponse(raw: unknown): {
  messageId: string;
  threadId?: string;
  labelIds?: string[];
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail returned an unexpected send response.",
    );
  }
  const r = raw as Record<string, unknown>;
  const message = r.message;
  if (message !== null && typeof message === "object") {
    const mr = message as Record<string, unknown>;
    const id = optionalString(mr.id);
    if (id !== undefined) {
      const out: {
        messageId: string;
        threadId?: string;
        labelIds?: string[];
      } = { messageId: id };
      const threadId = optionalString(mr.threadId);
      if (threadId !== undefined) {
        out.threadId = threadId;
      }
      const labelIds = optionalStringArray(mr.labelIds);
      if (labelIds !== undefined) {
        out.labelIds = labelIds;
      }
      return out;
    }
  }
  const id = optionalString(r.id);
  if (id !== undefined) {
    const out: {
      messageId: string;
      threadId?: string;
      labelIds?: string[];
    } = { messageId: id };
    const threadId = optionalString(r.threadId);
    if (threadId !== undefined) {
      out.threadId = threadId;
    }
    const labelIds = optionalStringArray(r.labelIds);
    if (labelIds !== undefined) {
      out.labelIds = labelIds;
    }
    return out;
  }
  throw new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Gmail returned an unexpected send response.",
  );
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `Gmail response missing ${label}.`,
    );
  }
  if ([...value].length > OUTPUT_MAX_PROVIDER_STRING_LENGTH) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Gmail response exceeds size limits.",
    );
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (value.length === 0) {
    return undefined;
  }
  return value;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string" && v.length > 0) {
      out.push(v);
    }
  }
  return out.length > 0 ? out : undefined;
}

function requireFiniteInt(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `Gmail response missing ${label}.`,
    );
  }
  return Math.trunc(value);
}

function optionalFiniteInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function redactOptionalLongString(
  value: unknown,
  maxCodePoints: number,
): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const t = truncateUnicodeByCodePoints(value, maxCodePoints);
  return t.value;
}

function extractHeadersMap(payload: unknown): Record<string, string> {
  if (payload === null || typeof payload !== "object") {
    return {};
  }
  const headers = (payload as { headers?: unknown }).headers;
  if (!Array.isArray(headers)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const h of headers) {
    if (h === null || typeof h !== "object") {
      continue;
    }
    const hr = h as { name?: unknown; value?: unknown };
    if (typeof hr.name !== "string" || typeof hr.value !== "string") {
      continue;
    }
    const name = hr.name.trim();
    if (name.length === 0) {
      continue;
    }
    out[name] = truncateUnicodeByCodePoints(
      hr.value,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  }
  return out;
}

function extractPlainTextBody(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== "object") {
    return undefined;
  }
  const p = payload as Record<string, unknown>;
  const mime = typeof p.mimeType === "string" ? p.mimeType : "";
  const body = p.body;
  if (
    mime === "text/plain" &&
    body !== null &&
    typeof body === "object" &&
    typeof (body as { data?: unknown }).data === "string"
  ) {
    return decodeBodyData((body as { data: string }).data);
  }
  const parts = p.parts;
  if (!Array.isArray(parts)) {
    return undefined;
  }
  const texts: string[] = [];
  for (const part of parts) {
    const inner = extractPlainTextBody(part);
    if (inner !== undefined) {
      texts.push(inner);
    }
  }
  if (texts.length === 0) {
    return undefined;
  }
  return texts.join("\n");
}

function decodeBodyData(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : normalized + "=".repeat(4 - pad);
  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}
