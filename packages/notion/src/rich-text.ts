import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_RICH_TEXT_SEGMENTS,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./constants.js";
import { normalizeTruncatableProviderString } from "./output-budget.js";

export interface NormalizedRichText {
  readonly plain: string;
  readonly plainTruncated?: true;
  readonly segmentsTruncated?: true;
  readonly untrustedContent: true;
}

function extractPlainFromRichTextArray(value: unknown): string {
  if (!Array.isArray(value)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Notion returned an unexpected rich text payload.",
    );
  }
  const limited = value.slice(0, MAX_RICH_TEXT_SEGMENTS);
  const parts: string[] = [];
  for (const item of limited) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const type = record.type;
    if (
      type === "text" &&
      record.text !== null &&
      typeof record.text === "object"
    ) {
      const content = (record.text as Record<string, unknown>).content;
      if (typeof content === "string") {
        parts.push(content);
      }
    } else if (type === "mention" || type === "equation") {
      parts.push(`[${String(type)}]`);
    }
  }
  const joined = parts.join("");
  const normalized = normalizeTruncatableProviderString(
    joined,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return normalized.value;
}

export function normalizeRichTextField(
  value: unknown,
): NormalizedRichText | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const plain = extractPlainFromRichTextArray(value);
  const normalized = normalizeTruncatableProviderString(
    plain,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const originalLength = [...plain].length;
  const truncatedByBudget = normalized.truncated;
  const arrayLimited =
    Array.isArray(value) && value.length > MAX_RICH_TEXT_SEGMENTS;
  return {
    plain: normalized.value,
    ...(truncatedByBudget ? { plainTruncated: true as const } : {}),
    ...(arrayLimited ? { segmentsTruncated: true as const } : {}),
    untrustedContent: true as const,
    ...(originalLength > 0 && normalized.value.length === 0
      ? { plainTruncated: true as const }
      : {}),
  };
}

export function richTextPlainFromProperty(value: unknown): string | undefined {
  const normalized = normalizeRichTextField(value);
  return normalized?.plain;
}
