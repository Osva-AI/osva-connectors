import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { DEFAULT_MAX_READ_CHARS, MAX_READ_CHARS } from "./constants.js";
import { truncateUnicodeByCodePoints } from "./output-budget.js";

export function decodeUtf8Text(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ConnectorSdkError(
      "UNSUPPORTED_FORMAT",
      "File content is not valid UTF-8 text.",
    );
  }
}

export function boundTextContent(
  text: string,
  maxChars: number | undefined,
): {
  text: string;
  contentTruncated?: true;
  maxCharsApplied: number;
} {
  const limit =
    maxChars !== undefined
      ? Math.min(maxChars, MAX_READ_CHARS)
      : DEFAULT_MAX_READ_CHARS;
  const bounded = truncateUnicodeByCodePoints(text, limit);
  return {
    text: bounded.value,
    ...(bounded.truncated ? { contentTruncated: true as const } : {}),
    maxCharsApplied: limit,
  };
}
