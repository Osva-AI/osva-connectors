import type { ResolvedCrawlLimits } from "./crawl-limits.js";
import {
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";

export interface NormalizedProviderUsage {
  readonly credits?: number;
}

export function normalizeProviderUsage(
  value: unknown,
): NormalizedProviderUsage | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const credits =
    typeof record.credits === "number" && Number.isFinite(record.credits)
      ? record.credits
      : undefined;
  if (credits === undefined) {
    return undefined;
  }
  return { credits };
}

function optionalUntrustedString(
  value: unknown,
): { value: string; truncated?: true; untrustedContent: true } | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const normalized = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return {
    value: normalized.value,
    ...(normalized.truncated ? { truncated: true as const } : {}),
    untrustedContent: true as const,
  };
}

export interface NormalizedSearchResultItem {
  readonly title?: string;
  readonly url?: string;
  readonly content?: string;
  readonly score?: number;
  readonly truncated?: true;
  readonly untrustedContent?: true;
}

export function normalizeSearchResultItem(
  raw: unknown,
): NormalizedSearchResultItem {
  if (raw === null || typeof raw !== "object") {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const title = optionalUntrustedString(record.title);
  const content = optionalUntrustedString(record.content);
  const url = typeof record.url === "string" ? record.url : undefined;
  const score =
    typeof record.score === "number" && Number.isFinite(record.score)
      ? record.score
      : undefined;

  return {
    ...(title !== undefined
      ? {
          title: title.value,
          ...(title.truncated ? { truncated: true as const } : {}),
          untrustedContent: true as const,
        }
      : {}),
    ...(content !== undefined
      ? {
          content: content.value,
          ...(content.truncated ? { truncated: true as const } : {}),
          untrustedContent: true as const,
        }
      : {}),
    ...(url !== undefined ? { url } : {}),
    ...(score !== undefined ? { score } : {}),
  };
}

export function mapSearchResponse(raw: unknown): {
  query?: string;
  results: NormalizedSearchResultItem[];
  answer?: string;
  answerUntrusted?: true;
  responseTimeSeconds?: number;
  requestId?: string;
  providerUsage?: NormalizedProviderUsage;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    return { results: [], untrustedContent: true as const };
  }
  const record = raw as Record<string, unknown>;
  const rawResults = Array.isArray(record.results) ? record.results : [];
  const results = rawResults.map((item) => normalizeSearchResultItem(item));
  const answerField = optionalUntrustedString(record.answer);
  const responseTimeSeconds =
    typeof record.response_time === "number" &&
    Number.isFinite(record.response_time)
      ? record.response_time
      : undefined;
  const requestId =
    typeof record.request_id === "string" ? record.request_id : undefined;
  const query = typeof record.query === "string" ? record.query : undefined;

  return {
    ...(query !== undefined ? { query } : {}),
    results,
    ...(answerField !== undefined
      ? {
          answer: answerField.value,
          answerUntrusted: true as const,
          ...(answerField.truncated ? { truncated: true as const } : {}),
        }
      : {}),
    ...(responseTimeSeconds !== undefined ? { responseTimeSeconds } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
    ...(normalizeProviderUsage(record.usage) !== undefined
      ? { providerUsage: normalizeProviderUsage(record.usage) }
      : {}),
    untrustedContent: true as const,
  };
}

export interface NormalizedExtractResultItem {
  readonly url?: string;
  readonly rawContent?: string;
  readonly truncated?: true;
  readonly untrustedContent?: true;
}

export function normalizeExtractResultItem(
  raw: unknown,
): NormalizedExtractResultItem {
  if (raw === null || typeof raw !== "object") {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url : undefined;
  const content = optionalUntrustedString(record.raw_content);
  return {
    ...(url !== undefined ? { url } : {}),
    ...(content !== undefined
      ? {
          rawContent: content.value,
          ...(content.truncated ? { truncated: true as const } : {}),
          untrustedContent: true as const,
        }
      : {}),
  };
}

export function mapExtractResponse(raw: unknown): {
  results: NormalizedExtractResultItem[];
  failedResults: Array<{ url?: string; error?: string }>;
  responseTimeSeconds?: number;
  requestId?: string;
  providerUsage?: NormalizedProviderUsage;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    return { results: [], failedResults: [], untrustedContent: true as const };
  }
  const record = raw as Record<string, unknown>;
  const rawResults = Array.isArray(record.results) ? record.results : [];
  const rawFailed = Array.isArray(record.failed_results)
    ? record.failed_results
    : [];
  const failedResults = rawFailed.map((item) => {
    if (item === null || typeof item !== "object") {
      return {};
    }
    const row = item as Record<string, unknown>;
    return {
      ...(typeof row.url === "string" ? { url: row.url } : {}),
      ...(typeof row.error === "string" ? { error: row.error } : {}),
    };
  });

  return {
    results: rawResults.map((item) => normalizeExtractResultItem(item)),
    failedResults,
    ...(typeof record.response_time === "number"
      ? { responseTimeSeconds: record.response_time as number }
      : {}),
    ...(typeof record.request_id === "string"
      ? { requestId: record.request_id }
      : {}),
    ...(normalizeProviderUsage(record.usage) !== undefined
      ? { providerUsage: normalizeProviderUsage(record.usage) }
      : {}),
    untrustedContent: true as const,
  };
}

export interface NormalizedCrawlResultItem {
  readonly url?: string;
  readonly rawContent?: string;
  readonly truncated?: true;
  readonly untrustedContent?: true;
}

export function normalizeCrawlResultItem(
  raw: unknown,
): NormalizedCrawlResultItem {
  if (raw === null || typeof raw !== "object") {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url : undefined;
  const content = optionalUntrustedString(record.raw_content);
  return {
    ...(url !== undefined ? { url } : {}),
    ...(content !== undefined
      ? {
          rawContent: content.value,
          ...(content.truncated ? { truncated: true as const } : {}),
          untrustedContent: true as const,
        }
      : {}),
  };
}

export function mapCrawlResponse(
  raw: unknown,
  limits?: ResolvedCrawlLimits,
): {
  baseUrl?: string;
  results: NormalizedCrawlResultItem[];
  responseTimeSeconds?: number;
  requestId?: string;
  providerUsage?: NormalizedProviderUsage;
  limitsApplied?: ResolvedCrawlLimits["applied"];
  limitsRequested?: ResolvedCrawlLimits["requested"];
  limitsClamped?: true;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    return { results: [], untrustedContent: true as const };
  }
  const record = raw as Record<string, unknown>;
  const rawResults = Array.isArray(record.results) ? record.results : [];

  return {
    ...(typeof record.base_url === "string"
      ? { baseUrl: record.base_url }
      : {}),
    results: rawResults.map((item) => normalizeCrawlResultItem(item)),
    ...(typeof record.response_time === "number"
      ? { responseTimeSeconds: record.response_time as number }
      : {}),
    ...(typeof record.request_id === "string"
      ? { requestId: record.request_id }
      : {}),
    ...(normalizeProviderUsage(record.usage) !== undefined
      ? { providerUsage: normalizeProviderUsage(record.usage) }
      : {}),
    ...(limits !== undefined
      ? {
          limitsApplied: limits.applied,
          limitsRequested: limits.requested,
          ...(limits.clamped ? { limitsClamped: true as const } : {}),
        }
      : {}),
    untrustedContent: true as const,
  };
}
