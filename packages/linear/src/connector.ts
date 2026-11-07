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
  LINEAR_COMMENT_CREATE_TOOL,
  LINEAR_ISSUE_CREATE_TOOL,
  LINEAR_ISSUE_GET_TOOL,
  LINEAR_ISSUE_LIST_TOOL,
  LINEAR_ISSUE_SEARCH_TOOL,
  LINEAR_ISSUE_UPDATE_TOOL,
  LINEAR_PROJECT_GET_TOOL,
  LINEAR_PROJECT_LIST_TOOL,
  LINEAR_TEAM_LIST_TOOL,
  LINEAR_VIEWER_GET_TOOL,
  LIST_MAX_FIRST,
} from "./constants.js";
import type { LinearClient } from "./linear-client.js";
import { mapLinearError } from "./map-linear-error.js";
import {
  extractIssueTeamId,
  normalizeCommentRecord,
  normalizeIssueRecord,
  normalizeProjectRecord,
  normalizeTeamRecord,
  normalizeViewerRecord,
} from "./normalize-linear.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import type { LinearConfig } from "./schemas.js";
import {
  commentCreateInputJsonSchema,
  commentCreateInputSchema,
  issueCreateInputJsonSchema,
  issueCreateInputSchema,
  issueGetInputJsonSchema,
  issueGetInputSchema,
  issueListInputJsonSchema,
  issueListInputSchema,
  issueSearchInputJsonSchema,
  issueSearchInputSchema,
  issueUpdateInputJsonSchema,
  issueUpdateInputSchema,
  projectGetInputJsonSchema,
  projectGetInputSchema,
  projectListInputJsonSchema,
  projectListInputSchema,
  teamListInputJsonSchema,
  teamListInputSchema,
  viewerGetInputJsonSchema,
  viewerGetInputSchema,
} from "./tool-schemas.js";

export interface CreateLinearConnectorOptions {
  readonly client: LinearClient;
  readonly config: LinearConfig;
  readonly credentialForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  credentialForRedaction?: string,
  ambiguousWrite?: boolean,
): ConnectorSdkError {
  return mapLinearError(error, {
    ...(credentialForRedaction !== undefined
      ? { credential: credentialForRedaction }
      : {}),
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}

function assertMutationsAllowed(config: LinearConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Linear mutations are disabled. Set OSVA_CONNECTOR_LINEAR_WRITE_ENABLED=true to allow writes.",
    );
  }
  if (!config.hostMutationsApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Linear mutations require host approval. Set OSVA_CONNECTOR_LINEAR_HOST_MUTATIONS_APPROVED=true.",
    );
  }
}

function assertTeamAllowed(config: LinearConfig, teamId: string): void {
  if (config.allowedTeamIds.length === 0) {
    return;
  }
  const normalized = teamId.toLowerCase();
  const allowed = config.allowedTeamIds.some(
    (id) => id.toLowerCase() === normalized,
  );
  if (!allowed) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Linear team is not in OSVA_CONNECTOR_LINEAR_ALLOWED_TEAM_IDS.",
    );
  }
}

function assertTeamFilterWhenRestricted(
  config: LinearConfig,
  teamId: string | undefined,
  toolLabel: string,
): void {
  if (config.allowedTeamIds.length === 0) {
    return;
  }
  if (teamId === undefined) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `${toolLabel} requires teamId when OSVA_CONNECTOR_LINEAR_ALLOWED_TEAM_IDS is set.`,
    );
  }
  assertTeamAllowed(config, teamId);
}

function issuePassesTeamAllowlist(config: LinearConfig, raw: unknown): boolean {
  if (config.allowedTeamIds.length === 0) {
    return true;
  }
  const teamId = extractIssueTeamId(raw);
  if (teamId === undefined) {
    return false;
  }
  const normalized = teamId.toLowerCase();
  return config.allowedTeamIds.some((id) => id.toLowerCase() === normalized);
}

function listEnvelope(pageInfo: {
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}) {
  return {
    hasNextPage: pageInfo.hasNextPage,
    ...(pageInfo.endCursor !== null && pageInfo.endCursor.length > 0
      ? { endCursor: pageInfo.endCursor }
      : {}),
  };
}

export function createLinearConnector(
  options: CreateLinearConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const redactionCredential = options.credentialForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Linear MCP connector for OSVA Connector Profile V1: viewer and team reads, bounded issue/project search and listing, and controlled issue/comment mutations when explicitly enabled and host-approved. Issue titles, descriptions, and comments are untrusted external content.",
    tools: [
      defineTool({
        name: LINEAR_VIEWER_GET_TOOL,
        description:
          "Returns the authenticated Linear viewer profile (read-only).",
        inputSchema: viewerGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = viewerGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getViewer({
              signal: context.signal,
            });
            const output = normalizeViewerRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: LINEAR_TEAM_LIST_TOOL,
        description:
          "Lists Linear teams visible to the credential with cursor pagination (first/after).",
        inputSchema: teamListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = teamListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const first = Math.min(parsed.data.first, LIST_MAX_FIRST);
            const result = await options.client.listTeams({
              first,
              ...(parsed.data.after !== undefined
                ? { after: parsed.data.after }
                : {}),
              signal: context.signal,
            });
            const teams = result.nodes.map((node) => normalizeTeamRecord(node));
            const packed = packListWithinOutputBudget(
              listEnvelope(result.pageInfo),
              "teams",
              teams,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: LINEAR_ISSUE_LIST_TOOL,
        description:
          "Lists Linear issues with optional team/project filters and cursor pagination (first/after).",
        inputSchema: issueListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertTeamFilterWhenRestricted(
            config,
            parsed.data.teamId,
            "linear.issue.list",
          );
          try {
            const first = Math.min(parsed.data.first, LIST_MAX_FIRST);
            const result = await options.client.listIssues({
              first,
              ...(parsed.data.after !== undefined
                ? { after: parsed.data.after }
                : {}),
              ...(parsed.data.teamId !== undefined
                ? { teamId: parsed.data.teamId }
                : {}),
              ...(parsed.data.projectId !== undefined
                ? { projectId: parsed.data.projectId }
                : {}),
              signal: context.signal,
            });
            const issues = result.nodes
              .filter((node) => issuePassesTeamAllowlist(config, node))
              .map((node) => normalizeIssueRecord(node));
            const packed = packListWithinOutputBudget(
              listEnvelope(result.pageInfo),
              "issues",
              issues,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: LINEAR_ISSUE_GET_TOOL,
        description: "Returns a normalized Linear issue by ID (read-only).",
        inputSchema: issueGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getIssue({
              issueId: parsed.data.issueId,
              signal: context.signal,
            });
            const teamId = extractIssueTeamId(raw);
            if (teamId !== undefined) {
              assertTeamAllowed(config, teamId);
            } else if (config.allowedTeamIds.length > 0) {
              throw new ConnectorSdkError(
                "FORBIDDEN",
                "Linear issue team could not be verified against OSVA_CONNECTOR_LINEAR_ALLOWED_TEAM_IDS.",
              );
            }
            const output = normalizeIssueRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: LINEAR_ISSUE_SEARCH_TOOL,
        description:
          "Searches Linear issues using the provider search API with bounded query length and pagination.",
        inputSchema: issueSearchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueSearchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const first = Math.min(parsed.data.first, LIST_MAX_FIRST);
            const result = await options.client.searchIssues({
              query: parsed.data.query,
              first,
              ...(parsed.data.after !== undefined
                ? { after: parsed.data.after }
                : {}),
              signal: context.signal,
            });
            const mapped = result.nodes
              .filter((node) => issuePassesTeamAllowlist(config, node))
              .map((node) => normalizeIssueRecord(node));
            const excludedByAllowlist =
              config.allowedTeamIds.length > 0 &&
              mapped.length < result.nodes.length;
            const packed = packListWithinOutputBudget(
              {
                ...listEnvelope(result.pageInfo),
                ...(excludedByAllowlist
                  ? { issuesExcludedByTeamAllowlist: true as const }
                  : {}),
              },
              "issues",
              mapped,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: LINEAR_PROJECT_LIST_TOOL,
        description:
          "Lists Linear projects with optional team filter and cursor pagination.",
        inputSchema: projectListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = projectListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const first = Math.min(parsed.data.first, LIST_MAX_FIRST);
            const result = await options.client.listProjects({
              first,
              ...(parsed.data.after !== undefined
                ? { after: parsed.data.after }
                : {}),
              ...(parsed.data.teamId !== undefined
                ? { teamId: parsed.data.teamId }
                : {}),
              signal: context.signal,
            });
            const projects = result.nodes.map((node) =>
              normalizeProjectRecord(node),
            );
            const packed = packListWithinOutputBudget(
              listEnvelope(result.pageInfo),
              "projects",
              projects,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: LINEAR_PROJECT_GET_TOOL,
        description: "Returns a normalized Linear project by ID (read-only).",
        inputSchema: projectGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = projectGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getProject({
              projectId: parsed.data.projectId,
              signal: context.signal,
            });
            const output = normalizeProjectRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: LINEAR_ISSUE_CREATE_TOOL,
        description:
          "Creates a Linear issue (mutating). Requires host-controlled write flags. No connector-level retries.",
        inputSchema: issueCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertMutationsAllowed(config);
          assertTeamAllowed(config, parsed.data.teamId);
          try {
            const raw = await options.client.createIssue({
              teamId: parsed.data.teamId,
              title: parsed.data.title,
              ...(parsed.data.description !== undefined
                ? { description: parsed.data.description }
                : {}),
              ...(parsed.data.projectId !== undefined
                ? { projectId: parsed.data.projectId }
                : {}),
              signal: context.signal,
            });
            const output = normalizeIssueRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential, true);
          }
        },
      }),
      defineTool({
        name: LINEAR_ISSUE_UPDATE_TOOL,
        description:
          "Updates a Linear issue (mutating). Requires host-controlled write flags. No connector-level retries.",
        inputSchema: issueUpdateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueUpdateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertMutationsAllowed(config);
          try {
            if (config.allowedTeamIds.length > 0) {
              const existing = await options.client.getIssue({
                issueId: parsed.data.issueId,
                signal: context.signal,
              });
              const teamId = extractIssueTeamId(existing);
              if (teamId !== undefined) {
                assertTeamAllowed(config, teamId);
              }
            }
            const raw = await options.client.updateIssue({
              issueId: parsed.data.issueId,
              ...(parsed.data.title !== undefined
                ? { title: parsed.data.title }
                : {}),
              ...(parsed.data.description !== undefined
                ? { description: parsed.data.description }
                : {}),
              ...(parsed.data.stateId !== undefined
                ? { stateId: parsed.data.stateId }
                : {}),
              signal: context.signal,
            });
            const output = normalizeIssueRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential, true);
          }
        },
      }),
      defineTool({
        name: LINEAR_COMMENT_CREATE_TOOL,
        description:
          "Creates a comment on a Linear issue (mutating). Requires host-controlled write flags. No connector-level retries.",
        inputSchema: commentCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = commentCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertMutationsAllowed(config);
          try {
            if (config.allowedTeamIds.length > 0) {
              const issue = await options.client.getIssue({
                issueId: parsed.data.issueId,
                signal: context.signal,
              });
              const teamId = extractIssueTeamId(issue);
              if (teamId !== undefined) {
                assertTeamAllowed(config, teamId);
              }
            }
            const raw = await options.client.createComment({
              issueId: parsed.data.issueId,
              body: parsed.data.body,
              signal: context.signal,
            });
            const output = normalizeCommentRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential, true);
          }
        },
      }),
    ],
  });
}
