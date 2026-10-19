import { ConnectorSdkError } from "@osva-ai/connector-sdk";

/**
 * Maximum UTF-8 byte length of `JSON.stringify` on the handler structured payload
 * (MCP `structuredContent`). Does not include duplicate JSON in MCP `content[].text`.
 */
export const OUTPUT_MAX_STRUCTURED_JSON_BYTES = 262_144;

export const OUTPUT_MAX_REPO_DESCRIPTION = 4_096;
export const OUTPUT_MAX_ISSUE_TITLE = 512;
export const OUTPUT_MAX_GITHUB_LOGIN = 100;
export const OUTPUT_MAX_URL = 2_048;
export const OUTPUT_MAX_REPO_NAME = 256;
export const OUTPUT_MAX_REPO_FULL_NAME = 512;
export const OUTPUT_MAX_BRANCH_NAME = 255;
export const OUTPUT_MAX_ISO_TIMESTAMP = 64;
export const OUTPUT_MAX_COMMENT_BODY = 32_000;

const OUTPUT_SIZE_LIMIT_MESSAGE =
  "Normalized GitHub response exceeds the connector output size limit.";

const UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE =
  "GitHub returned an unexpected issue payload.";

export function structuredOutputByteLength(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function assertStructuredOutputWithinBudget(payload: unknown): void {
  if (structuredOutputByteLength(payload) > OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }
}

export function truncateUnicodeByCodePoints(
  text: string,
  maxCodePoints: number,
): { value: string; truncated: boolean } {
  if (maxCodePoints <= 0) {
    return { value: "", truncated: text.length > 0 };
  }
  const codePoints = [...text];
  if (codePoints.length <= maxCodePoints) {
    return { value: text, truncated: false };
  }
  return {
    value: codePoints.slice(0, maxCodePoints).join(""),
    truncated: true,
  };
}

export function normalizeTruncatableProviderString(
  value: unknown,
  maxCodePoints: number,
): { value: string; truncated: boolean } {
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE,
    );
  }
  return truncateUnicodeByCodePoints(value, maxCodePoints);
}

export function normalizeOptionalTruncatableString(
  value: unknown,
  maxCodePoints: number,
): { value: string | null; truncated: boolean } {
  if (value === null || value === undefined) {
    return { value: null, truncated: false };
  }
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "GitHub returned an unexpected repository payload.",
    );
  }
  const result = truncateUnicodeByCodePoints(value, maxCodePoints);
  return { value: result.value, truncated: result.truncated };
}

export function normalizeEssentialProviderString(
  value: unknown,
  maxCodePoints: number,
  message = UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE,
): string {
  if (typeof value !== "string") {
    throw new ConnectorSdkError("PROVIDER_ERROR", message);
  }
  if ([...value].length > maxCodePoints) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }
  return value;
}

export function normalizeProviderUrl(value: unknown): string {
  const url = normalizeEssentialProviderString(
    value,
    OUTPUT_MAX_URL,
    "GitHub returned an unexpected URL in the provider payload.",
  );
  return url;
}

export function normalizeProviderTimestamp(value: unknown): string {
  return normalizeEssentialProviderString(
    value,
    OUTPUT_MAX_ISO_TIMESTAMP,
    UNEXPECTED_PROVIDER_PAYLOAD_MESSAGE,
  );
}

export function normalizeOptionalLogin(value: unknown): {
  login: string | null;
  truncated: boolean;
} {
  if (value === null || value === undefined) {
    return { login: null, truncated: false };
  }
  const result = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_GITHUB_LOGIN,
  );
  return { login: result.value, truncated: result.truncated };
}

export interface IssueListEnvelope {
  readonly page: number;
  readonly perPage: number;
  readonly hasNextPage?: boolean;
}

export function packIssuesWithinOutputBudget<TIssue>(
  base: IssueListEnvelope,
  issues: readonly TIssue[],
): IssueListEnvelope & { issues: TIssue[]; issuesTruncated?: true } {
  const packed: TIssue[] = [];
  let issuesTruncated = false;

  for (const issue of issues) {
    const candidate = {
      ...base,
      issues: [...packed, issue],
    };
    if (
      structuredOutputByteLength(candidate) > OUTPUT_MAX_STRUCTURED_JSON_BYTES
    ) {
      issuesTruncated = true;
      break;
    }
    packed.push(issue);
  }

  if (packed.length === 0 && issues.length > 0) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }

  return {
    ...base,
    issues: packed,
    ...(issuesTruncated ? { issuesTruncated: true as const } : {}),
  };
}
