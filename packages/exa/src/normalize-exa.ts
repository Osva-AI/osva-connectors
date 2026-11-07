import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { ANSWER_PROVIDER_DISCLAIMER } from "./constants.js";
import {
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";

export interface NormalizedSearchResult {
  readonly id?: string;
  readonly title?: string;
  readonly url?: string;
  readonly publishedDate?: string;
  readonly author?: string | null;
  readonly text?: string;
  readonly textTruncated?: true;
  readonly highlights?: string[];
  readonly highlightsTruncated?: true;
  readonly summary?: string;
  readonly summaryTruncated?: true;
  readonly untrustedContent: true;
}

function optionalTruncatedString(value: unknown): {
  value?: string;
  truncated?: true;
} {
  if (value === undefined || value === null) {
    return {};
  }
  const normalized = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return {
    value: normalized.value,
    ...(normalized.truncated ? { truncated: true as const } : {}),
  };
}

function normalizeHighlights(value: unknown): {
  highlights?: string[];
  highlightsTruncated?: true;
} {
  if (!Array.isArray(value)) {
    return {};
  }
  const highlights: string[] = [];
  let highlightsTruncated = false;
  for (const item of value) {
    const part = optionalTruncatedString(item);
    if (part.value === undefined) {
      continue;
    }
    if (part.truncated === true) {
      highlightsTruncated = true;
    }
    highlights.push(part.value);
    if (highlights.length >= 50) {
      highlightsTruncated = true;
      break;
    }
  }
  return {
    ...(highlights.length > 0 ? { highlights } : {}),
    ...(highlightsTruncated ? { highlightsTruncated: true as const } : {}),
  };
}

export function normalizeSearchResultItem(
  raw: unknown,
): NormalizedSearchResult {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const title = optionalTruncatedString(record.title);
  const text = optionalTruncatedString(record.text);
  const summary = optionalTruncatedString(record.summary);
  const highlightFields = normalizeHighlights(record.highlights);
  return {
    ...(typeof record.id === "string" ? { id: record.id } : {}),
    ...(title.value !== undefined ? { title: title.value } : {}),
    ...(typeof record.url === "string" ? { url: record.url } : {}),
    ...(typeof record.publishedDate === "string"
      ? { publishedDate: record.publishedDate }
      : {}),
    ...(record.author === null || typeof record.author === "string"
      ? { author: record.author as string | null }
      : {}),
    ...(text.value !== undefined ? { text: text.value } : {}),
    ...(text.truncated === true ? { textTruncated: true as const } : {}),
    ...highlightFields,
    ...(summary.value !== undefined ? { summary: summary.value } : {}),
    ...(summary.truncated === true ? { summaryTruncated: true as const } : {}),
    untrustedContent: true as const,
  };
}

function extractResultsArray(payload: unknown): unknown[] {
  if (payload === null || typeof payload !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa returned an unexpected payload.",
    );
  }
  const results = (payload as Record<string, unknown>).results;
  if (!Array.isArray(results)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa returned an unexpected payload.",
    );
  }
  return results;
}

export function normalizeSearchResponse(payload: unknown): {
  requestId?: string;
  results: NormalizedSearchResult[];
} {
  const record =
    payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const results = extractResultsArray(payload).map((item) =>
    normalizeSearchResultItem(item),
  );
  return {
    ...(typeof record.requestId === "string"
      ? { requestId: record.requestId }
      : {}),
    results,
  };
}

export function normalizeContentsResponse(payload: unknown): {
  requestId?: string;
  results: NormalizedSearchResult[];
  statuses?: Array<{ id: string; status: string }>;
} {
  const record =
    payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const results = extractResultsArray(payload).map((item) =>
    normalizeSearchResultItem(item),
  );
  const statusesRaw = record.statuses;
  const statuses = Array.isArray(statusesRaw)
    ? statusesRaw
        .map((entry) => {
          if (entry === null || typeof entry !== "object") {
            return undefined;
          }
          const row = entry as Record<string, unknown>;
          if (typeof row.id === "string" && typeof row.status === "string") {
            return { id: row.id, status: row.status };
          }
          return undefined;
        })
        .filter(
          (row): row is { id: string; status: string } => row !== undefined,
        )
    : undefined;
  return {
    ...(typeof record.requestId === "string"
      ? { requestId: record.requestId }
      : {}),
    results,
    ...(statuses !== undefined && statuses.length > 0 ? { statuses } : {}),
  };
}

export interface NormalizedCitation {
  readonly title?: string;
  readonly url?: string;
  readonly publishedDate?: string;
  readonly author?: string | null;
  readonly id?: string;
  readonly text?: string;
  readonly textTruncated?: true;
  readonly untrustedContent: true;
}

export function normalizeAnswerResponse(payload: unknown): {
  requestId?: string;
  answer: string;
  answerDisclaimer: string;
  citations: NormalizedCitation[];
  untrustedContent: true;
} {
  if (payload === null || typeof payload !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa returned an unexpected payload.",
    );
  }
  const record = payload as Record<string, unknown>;
  let answerText: string;
  if (typeof record.answer === "string") {
    answerText = normalizeTruncatableProviderString(
      record.answer,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  } else if (record.answer !== undefined) {
    answerText = normalizeTruncatableProviderString(
      JSON.stringify(record.answer),
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  } else {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Exa returned an unexpected payload.",
    );
  }

  const citationsRaw = record.citations;
  const citations: NormalizedCitation[] = Array.isArray(citationsRaw)
    ? citationsRaw.map((item) => {
        if (item === null || typeof item !== "object") {
          throw new ConnectorSdkError(
            "PROVIDER_ERROR",
            "Exa returned an unexpected payload.",
          );
        }
        const row = item as Record<string, unknown>;
        const text = optionalTruncatedString(row.text);
        const title = optionalTruncatedString(row.title);
        return {
          ...(title.value !== undefined ? { title: title.value } : {}),
          ...(typeof row.url === "string" ? { url: row.url } : {}),
          ...(typeof row.publishedDate === "string"
            ? { publishedDate: row.publishedDate }
            : {}),
          ...(row.author === null || typeof row.author === "string"
            ? { author: row.author as string | null }
            : {}),
          ...(typeof row.id === "string" ? { id: row.id } : {}),
          ...(text.value !== undefined ? { text: text.value } : {}),
          ...(text.truncated === true ? { textTruncated: true as const } : {}),
          untrustedContent: true as const,
        };
      })
    : [];

  return {
    ...(typeof record.requestId === "string"
      ? { requestId: record.requestId }
      : {}),
    answer: answerText,
    answerDisclaimer: ANSWER_PROVIDER_DISCLAIMER,
    citations,
    untrustedContent: true as const,
  };
}
