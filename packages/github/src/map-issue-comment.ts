import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { GithubIssueCommentRecord } from "./github-client.js";
import {
  issueCommentCreateOutputSchema,
  type IssueCommentCreateOutput,
} from "./issue-schemas.js";
import {
  normalizeOptionalLogin,
  normalizeProviderTimestamp,
  normalizeProviderUrl,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_COMMENT_BODY,
} from "./output-budget.js";

export function mapGithubIssueCommentCreateRecord(
  record: GithubIssueCommentRecord,
  issueNumber: number,
): IssueCommentCreateOutput {
  const body = normalizeTruncatableProviderString(
    record.body,
    OUTPUT_MAX_COMMENT_BODY,
  );
  const author = normalizeOptionalLogin(record.user?.login ?? null);

  const mapped = {
    id: record.id,
    issueNumber,
    body: body.value,
    ...(body.truncated ? { bodyTruncated: true } : {}),
    htmlUrl: normalizeProviderUrl(record.html_url),
    createdAt: normalizeProviderTimestamp(record.created_at),
    authorLogin: author.login,
    ...(author.truncated ? { authorLoginTruncated: true } : {}),
  };

  const parsed = issueCommentCreateOutputSchema.safeParse(mapped);
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "GitHub returned an unexpected issue comment payload.",
    );
  }

  return parsed.data;
}
