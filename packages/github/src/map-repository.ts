import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { GithubRepositoryRecord } from "./github-client.js";
import {
  normalizeEssentialProviderString,
  normalizeOptionalTruncatableString,
  normalizeProviderUrl,
  OUTPUT_MAX_BRANCH_NAME,
  OUTPUT_MAX_REPO_DESCRIPTION,
  OUTPUT_MAX_REPO_FULL_NAME,
  OUTPUT_MAX_REPO_NAME,
} from "./output-budget.js";
import {
  repositoryGetOutputSchema,
  type RepositoryGetOutput,
} from "./schemas.js";

function mapVisibility(
  record: GithubRepositoryRecord,
): RepositoryGetOutput["visibility"] {
  if (record.visibility === "public") {
    return "public";
  }
  if (record.visibility === "private") {
    return "private";
  }
  if (record.visibility === "internal") {
    return "internal";
  }
  if (record.private === true) {
    return "private";
  }
  if (record.private === false) {
    return "public";
  }
  return "unknown";
}

export function mapRepositoryRecord(
  record: GithubRepositoryRecord,
): RepositoryGetOutput {
  const description = normalizeOptionalTruncatableString(
    record.description,
    OUTPUT_MAX_REPO_DESCRIPTION,
  );

  const mapped = {
    name: normalizeEssentialProviderString(
      record.name,
      OUTPUT_MAX_REPO_NAME,
      "GitHub returned an unexpected repository payload.",
    ),
    fullName: normalizeEssentialProviderString(
      record.full_name,
      OUTPUT_MAX_REPO_FULL_NAME,
      "GitHub returned an unexpected repository payload.",
    ),
    description: description.value,
    htmlUrl: normalizeProviderUrl(record.html_url),
    visibility: mapVisibility(record),
    defaultBranch: normalizeEssentialProviderString(
      record.default_branch,
      OUTPUT_MAX_BRANCH_NAME,
      "GitHub returned an unexpected repository payload.",
    ),
    archived: record.archived,
    fork: record.fork,
    ...(description.truncated ? { descriptionTruncated: true } : {}),
  };

  const parsed = repositoryGetOutputSchema.safeParse(mapped);
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "GitHub returned an unexpected repository payload.",
    );
  }

  return parsed.data;
}
