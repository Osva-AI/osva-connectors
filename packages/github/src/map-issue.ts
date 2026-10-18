import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_LABEL_NAME_LENGTH, MAX_LABELS_PER_ISSUE } from "./constants.js";
import type { GithubIssueRecord } from "./github-client.js";
import {
  normalizedIssueSchema,
  type NormalizedIssue,
} from "./issue-schemas.js";

function isPullRequest(record: GithubIssueRecord): boolean {
  return record.pull_request !== undefined && record.pull_request !== null;
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
    const name =
      label.name.length > MAX_LABEL_NAME_LENGTH
        ? label.name.slice(0, MAX_LABEL_NAME_LENGTH)
        : label.name;
    if (name.length < label.name.length) {
      truncated = true;
    }
    names.push(name);
  }
  if (labels.length > names.length) {
    truncated = true;
  }
  return { labels: names, labelsTruncated: truncated };
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
    number: record.number,
    title: record.title,
    state: record.state === "closed" ? "closed" : "open",
    htmlUrl: record.html_url,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    closedAt: record.closed_at,
    authorLogin: record.user?.login ?? null,
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
