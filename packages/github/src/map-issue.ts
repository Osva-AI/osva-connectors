import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_LABEL_NAME_LENGTH, MAX_LABELS_PER_ISSUE } from "./constants.js";
import type { GithubIssueRecord } from "./github-client.js";
import {
  issueCreateOutputSchema,
  normalizedIssueSchema,
  type IssueCreateOutput,
  type NormalizedIssue,
} from "./issue-schemas.js";
import {
  normalizeOptionalLogin,
  normalizeProviderTimestamp,
  normalizeProviderUrl,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_ISSUE_TITLE,
  truncateUnicodeByCodePoints,
} from "./output-budget.js";

function isPullRequest(record: GithubIssueRecord): boolean {
  return record.pull_request !== undefined && record.pull_request !== null;
}

/** Rejects pull requests before issue-only mutating operations (e.g. comment create). */
export function ensureGithubIssueNotPullRequest(
  record: GithubIssueRecord,
): void {
  if (isPullRequest(record)) {
    throw new ConnectorSdkError(
      "NOT_ISSUE",
      "The requested resource is a pull request, not an issue.",
    );
  }
}

function normalizeLabels(labels: GithubIssueRecord["labels"]): {
  labels: string[];
  labelsTruncated: boolean;
} {
  const names: string[] = [];
  let truncated = false;
  for (const label of labels) {
    if (names.length >= MAX_LABELS_PER_ISSUE) {
      truncated = true;
      break;
    }
    if (typeof label.name !== "string" || label.name.length === 0) {
      continue;
    }
    const bounded = truncateUnicodeByCodePoints(
      label.name,
      MAX_LABEL_NAME_LENGTH,
    );
    if (bounded.truncated) {
      truncated = true;
    }
    names.push(bounded.value);
  }
  if (labels.length > names.length) {
    truncated = true;
  }
  return { labels: names, labelsTruncated: truncated };
}

function normalizeIssueTitle(title: unknown): {
  title: string;
  titleTruncated?: true;
} {
  const bounded = normalizeTruncatableProviderString(
    title,
    OUTPUT_MAX_ISSUE_TITLE,
  );
  return {
    title: bounded.value,
    ...(bounded.truncated ? { titleTruncated: true as const } : {}),
  };
}

function normalizeAuthorLogin(record: GithubIssueRecord): {
  authorLogin: string | null;
  authorLoginTruncated?: true;
} {
  const login = normalizeOptionalLogin(record.user?.login ?? null);
  return {
    authorLogin: login.login,
    ...(login.truncated ? { authorLoginTruncated: true as const } : {}),
  };
}

function baseIssueFields(record: GithubIssueRecord) {
  const title = normalizeIssueTitle(record.title);
  const author = normalizeAuthorLogin(record);
  return {
    number: record.number,
    ...title,
    state: record.state === "closed" ? ("closed" as const) : ("open" as const),
    htmlUrl: normalizeProviderUrl(record.html_url),
    createdAt: normalizeProviderTimestamp(record.created_at),
    updatedAt: normalizeProviderTimestamp(record.updated_at),
    closedAt:
      record.closed_at === null || record.closed_at === undefined
        ? null
        : normalizeProviderTimestamp(record.closed_at),
    ...author,
  };
}

export function mapGithubIssueRecord(
  record: GithubIssueRecord,
): NormalizedIssue {
  if (isPullRequest(record)) {
    throw new ConnectorSdkError(
      "NOT_ISSUE",
      "The requested resource is a pull request, not an issue.",
    );
  }

  const { labels, labelsTruncated } = normalizeLabels(record.labels);

  const mapped = {
    ...baseIssueFields(record),
    labels,
    commentsCount: record.comments,
    ...(labelsTruncated ? { labelsTruncated: true } : {}),
  };

  const parsed = normalizedIssueSchema.safeParse(mapped);
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "GitHub returned an unexpected issue payload.",
    );
  }

  return parsed.data;
}

export function mapGithubIssueCreateRecord(
  record: GithubIssueRecord,
): IssueCreateOutput {
  if (isPullRequest(record)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "GitHub returned an unexpected issue payload.",
    );
  }

  const title = normalizeIssueTitle(record.title);
  const author = normalizeAuthorLogin(record);

  const mapped = {
    number: record.number,
    title: title.title,
    ...(title.titleTruncated ? { titleTruncated: true } : {}),
    state: record.state === "closed" ? ("closed" as const) : ("open" as const),
    htmlUrl: normalizeProviderUrl(record.html_url),
    createdAt: normalizeProviderTimestamp(record.created_at),
    authorLogin: author.authorLogin,
    ...(author.authorLoginTruncated ? { authorLoginTruncated: true } : {}),
  };

  const parsed = issueCreateOutputSchema.safeParse(mapped);
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "GitHub returned an unexpected issue payload.",
    );
  }

  return parsed.data;
}

export function mapGithubIssueListItems(
  records: readonly GithubIssueRecord[],
): NormalizedIssue[] {
  const issues: NormalizedIssue[] = [];
  for (const record of records) {
    if (isPullRequest(record)) {
      continue;
    }
    issues.push(mapGithubIssueRecord(record));
  }
  return issues;
}
