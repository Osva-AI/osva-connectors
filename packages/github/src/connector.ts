import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  GITHUB_ISSUE_CREATE_TOOL,
  GITHUB_ISSUE_GET_TOOL,
  GITHUB_ISSUE_LIST_TOOL,
  GITHUB_REPOSITORY_GET_TOOL,
} from "./constants.js";
import type { GithubClient } from "./github-client.js";
import {
  issueCreateInputJsonSchema,
  issueCreateInputSchema,
  issueGetInputJsonSchema,
  issueGetInputSchema,
  issueListInputJsonSchema,
  issueListInputSchema,
  issueListOutputSchema,
} from "./issue-schemas.js";
import {
  mapGithubIssueCreateRecord,
  mapGithubIssueListItems,
  mapGithubIssueRecord,
} from "./map-issue.js";
import { mapGithubError } from "./map-github-error.js";
import { mapRepositoryRecord } from "./map-repository.js";
import {
  repositoryGetInputJsonSchema,
  repositoryGetInputSchema,
} from "./schemas.js";

export interface CreateGithubConnectorOptions {
  readonly client: GithubClient;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

export function createGithubConnector(
  options: CreateGithubConnectorOptions,
): DefinedConnector {
  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "GitHub connector for OSVA Connector Profile V1 (repository and issue read, issue create). Tool authorization is enforced by OSVA ToolPolicy; GitHub credentials control provider-side access. Human approval for mutating tools must be enforced by the calling OSVA workflow when required.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: GITHUB_REPOSITORY_GET_TOOL,
        description:
          "Returns basic metadata for a GitHub repository (read-only).",
        inputSchema: repositoryGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = repositoryGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw new ConnectorSdkError(
              "INVALID_INPUT",
              "Invalid owner or repository name.",
            );
          }

          try {
            const record = await options.client.getRepository({
              owner: parsed.data.owner,
              repo: parsed.data.repo,
              signal: context.signal,
            });
            return mapRepositoryRecord(record);
          } catch (error) {
            throw mapGithubError(error);
          }
        },
      }),
      defineTool({
        name: GITHUB_ISSUE_LIST_TOOL,
        description:
          "Lists GitHub issues for a repository with bounded page-based pagination. Pull requests are excluded. Each invocation performs exactly one GitHub API request.",
        inputSchema: issueListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }

          try {
            const result = await options.client.listIssues({
              owner: parsed.data.owner,
              repo: parsed.data.repo,
              state: parsed.data.state,
              perPage: parsed.data.perPage,
              page: parsed.data.page,
              signal: context.signal,
            });

            const output = issueListOutputSchema.parse({
              issues: mapGithubIssueListItems(result.items),
              page: result.page,
              perPage: result.perPage,
              ...(result.hasNextPage ? { hasNextPage: true } : {}),
            });
            return output;
          } catch (error) {
            throw mapGithubError(error);
          }
        },
      }),
      defineTool({
        name: GITHUB_ISSUE_GET_TOOL,
        description:
          "Returns metadata for a single GitHub issue by number (read-only). Pull requests are rejected.",
        inputSchema: issueGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }

          try {
            const record = await options.client.getIssue({
              owner: parsed.data.owner,
              repo: parsed.data.repo,
              issueNumber: parsed.data.issueNumber,
              signal: context.signal,
            });
            return mapGithubIssueRecord(record);
          } catch (error) {
            throw mapGithubError(error);
          }
        },
      }),
      defineTool({
        name: GITHUB_ISSUE_CREATE_TOOL,
        description:
          "Creates a GitHub issue (mutating). Each invocation performs exactly one GitHub REST create request with no connector-level retries. GitHub does not provide a guaranteed idempotency key for issue creation in this implementation.",
        inputSchema: issueCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }

          try {
            const record = await options.client.createIssue({
              owner: parsed.data.owner,
              repo: parsed.data.repo,
              title: parsed.data.title,
              ...(parsed.data.body !== undefined
                ? { body: parsed.data.body }
                : {}),
              signal: context.signal,
            });
            return mapGithubIssueCreateRecord(record);
          } catch (error) {
            throw mapGithubError(error, { ambiguousWrite: true });
          }
        },
      }),
    ],
  });
}
