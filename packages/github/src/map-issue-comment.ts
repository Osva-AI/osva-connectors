import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { GithubIssueCommentRecord } from "./github-client.js";
import {
  issueCommentCreateOutputSchema,
  type IssueCommentCreateOutput,
} from "./issue-schemas.js";

export function mapGithubIssueCommentCreateRecord(
  record: GithubIssueCommentRecord,
  issueNumber: number,
): IssueCommentCreateOutput {
  const mapped = {
    id: record.id,
    issueNumber,
    body: record.body,
    htmlUrl: record.html_url,
    createdAt: record.created_at,
    authorLogin: record.user?.login ?? null,
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
