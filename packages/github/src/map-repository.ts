import type { GithubRepositoryRecord } from "./github-client.js";
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
  return repositoryGetOutputSchema.parse({
    name: record.name,
    fullName: record.full_name,
    description: record.description,
    htmlUrl: record.html_url,
    visibility: mapVisibility(record),
    defaultBranch: record.default_branch,
    archived: record.archived,
    fork: record.fork,
  });
}
