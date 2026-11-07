import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import { plainTextToAdf } from "./adf.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  JIRA_ISSUE_COMMENT_CREATE_TOOL,
  JIRA_ISSUE_CREATE_TOOL,
  JIRA_ISSUE_GET_TOOL,
  JIRA_ISSUE_SEARCH_TOOL,
  JIRA_ISSUE_TRANSITION_TOOL,
  JIRA_ISSUE_TRANSITIONS_LIST_TOOL,
  JIRA_ISSUE_UPDATE_TOOL,
  JIRA_PROJECT_GET_TOOL,
  JIRA_PROJECT_LIST_TOOL,
  LIST_MAX_PAGE_SIZE,
} from "./constants.js";
import type { JiraClient } from "./jira-client.js";
import { wrapJqlWithProjectAllowlist } from "./jql-allowlist.js";
import { mapJiraError } from "./map-jira-error.js";
import {
  extractIssueProjectKey,
  normalizeCreateIssueResponse,
  normalizeIssueRecord,
  normalizeProjectRecord,
  normalizeTransitionList,
} from "./normalize-jira.js";
import {
  assertMutationsProjectAllowlistReady,
  assertProjectAllowed,
  createProjectAllowlist,
  filterByProjectAllowlist,
} from "./project-allowlist.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import type { JiraConfig } from "./schemas.js";
import {
  issueCommentCreateInputJsonSchema,
  issueCommentCreateInputSchema,
  issueCreateInputJsonSchema,
  issueCreateInputSchema,
  issueGetInputJsonSchema,
  issueGetInputSchema,
  issueSearchInputJsonSchema,
  issueSearchInputSchema,
  issueTransitionInputJsonSchema,
  issueTransitionInputSchema,
  issueTransitionsListInputJsonSchema,
  issueTransitionsListInputSchema,
  issueUpdateInputJsonSchema,
  issueUpdateInputSchema,
  projectGetInputJsonSchema,
  projectGetInputSchema,
  projectListInputJsonSchema,
  projectListInputSchema,
} from "./tool-schemas.js";

export interface CreateJiraConnectorOptions {
  readonly client: JiraClient;
  readonly config: JiraConfig;
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
  return mapJiraError(error, {
    ...(credentialForRedaction !== undefined
      ? { credential: credentialForRedaction }
      : {}),
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}

function assertWritesAllowed(config: JiraConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Jira mutations are disabled. Set OSVA_CONNECTOR_JIRA_WRITE_ENABLED=true to allow writes.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Jira mutations require host approval. Set OSVA_CONNECTOR_JIRA_HOST_WRITES_APPROVED=true.",
    );
  }
}

async function assertIssueProjectAllowed(
  client: JiraClient,
  allowlist: ReturnType<typeof createProjectAllowlist>,
  issueKey: string,
  signal: AbortSignal | undefined,
): Promise<string | undefined> {
  const raw = await client.getIssue(issueKey, signal);
  const projectKey = extractIssueProjectKey(raw);
  if (projectKey !== undefined) {
    assertProjectAllowed(allowlist, projectKey, "Issue project");
  }
  return projectKey;
}

export function createJiraConnector(
  options: CreateJiraConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const allowlist = createProjectAllowlist(config.allowedProjectKeys);
  const redactionCredential = options.credentialForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Jira Cloud MCP connector for OSVA Connector Profile V1: bounded project and issue reads (JQL via POST /rest/api/3/search/jql), transition discovery, and controlled issue mutations when explicitly enabled and host-approved. Issue text is untrusted external content. Hosts may restrict access with OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS.",
    tools: [
      defineTool({
        name: JIRA_PROJECT_LIST_TOOL,
        description:
          "Lists Jira projects visible to the credential with bounded pagination. When OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS is set, only allowlisted project keys are returned.",
        inputSchema: projectListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = projectListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const maxResults = Math.min(
              parsed.data.maxResults,
              LIST_MAX_PAGE_SIZE,
            );
            const result = await options.client.searchProjects({
              startAt: parsed.data.startAt,
              maxResults,
              signal: context.signal,
            });
            const mapped = result.values.map((item) =>
              normalizeProjectRecord(item),
            );
            const filtered = filterByProjectAllowlist(
              allowlist,
              mapped,
              (p) => p.key,
            );
            const envelope = {
              ...(result.total !== undefined ? { total: result.total } : {}),
              ...(result.isLast === true ? { isLast: true } : {}),
              ...(result.nextPageToken !== undefined
                ? { nextPageToken: result.nextPageToken }
                : {}),
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "projects",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: JIRA_PROJECT_GET_TOOL,
        description:
          "Returns normalized metadata for a Jira project (read-only).",
        inputSchema: projectGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = projectGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertProjectAllowed(
              allowlist,
              parsed.data.projectIdOrKey,
              "Project key",
            );
            const raw = await options.client.getProject(
              parsed.data.projectIdOrKey,
              context.signal,
            );
            const output = normalizeProjectRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: JIRA_ISSUE_SEARCH_TOOL,
        description:
          "Searches Jira issues with JQL using POST /rest/api/3/search/jql and nextPageToken pagination (not legacy /search). When a project allowlist is configured, user JQL is scoped and results are filtered by project key.",
        inputSchema: issueSearchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueSearchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const maxResults = Math.min(
              parsed.data.maxResults,
              LIST_MAX_PAGE_SIZE,
            );
            let jql = parsed.data.jql;
            if (allowlist !== undefined) {
              jql = wrapJqlWithProjectAllowlist(jql, allowlist.allowedKeys);
            }
            const result = await options.client.searchIssues({
              jql,
              maxResults,
              ...(parsed.data.nextPageToken !== undefined
                ? { nextPageToken: parsed.data.nextPageToken }
                : {}),
              ...(parsed.data.fields !== undefined
                ? { fields: parsed.data.fields }
                : {}),
              signal: context.signal,
            });
            const mapped = result.issues.map((item) =>
              normalizeIssueRecord(item),
            );
            const filtered = filterByProjectAllowlist(
              allowlist,
              mapped,
              (issue) => issue.projectKey,
            );
            const envelope = {
              ...(result.isLast === true ? { isLast: true } : {}),
              ...(result.nextPageToken !== undefined
                ? { nextPageToken: result.nextPageToken }
                : {}),
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "issues",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: JIRA_ISSUE_GET_TOOL,
        description:
          "Returns normalized metadata for a Jira issue (read-only). Summary and description text are untrusted.",
        inputSchema: issueGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getIssue(
              parsed.data.issueKey,
              context.signal,
            );
            const projectKey = extractIssueProjectKey(raw);
            if (projectKey !== undefined) {
              assertProjectAllowed(allowlist, projectKey, "Issue project");
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
        name: JIRA_ISSUE_TRANSITIONS_LIST_TOOL,
        description:
          "Lists available workflow transitions for an issue (read-only).",
        inputSchema: issueTransitionsListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueTransitionsListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            await assertIssueProjectAllowed(
              options.client,
              allowlist,
              parsed.data.issueKey,
              context.signal,
            );
            const raw = await options.client.listIssueTransitions(
              parsed.data.issueKey,
              context.signal,
            );
            const transitions = normalizeTransitionList(raw);
            const output = { transitions, untrustedContent: true as const };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: JIRA_ISSUE_CREATE_TOOL,
        description:
          "Creates a Jira issue (mutating). Description is sent as Atlassian Document Format. Requires write flags and allowlisted project when OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS is set. No connector-level retries.",
        inputSchema: issueCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          assertMutationsProjectAllowlistReady(allowlist);
          assertProjectAllowed(
            allowlist,
            parsed.data.projectKey,
            "Project key",
          );
          try {
            const descriptionAdf =
              parsed.data.descriptionText !== undefined
                ? plainTextToAdf(parsed.data.descriptionText)
                : undefined;
            const raw = await options.client.createIssue({
              projectKey: parsed.data.projectKey,
              issueTypeId: parsed.data.issueTypeId,
              summary: parsed.data.summary,
              ...(descriptionAdf !== undefined ? { descriptionAdf } : {}),
              signal: context.signal,
            });
            const output = normalizeCreateIssueResponse(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential, true);
          }
        },
      }),
      defineTool({
        name: JIRA_ISSUE_UPDATE_TOOL,
        description:
          "Updates Jira issue fields (mutating). Description is sent as ADF when provided. Requires write flags. No connector-level retries.",
        inputSchema: issueUpdateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueUpdateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          assertMutationsProjectAllowlistReady(allowlist);
          try {
            await assertIssueProjectAllowed(
              options.client,
              allowlist,
              parsed.data.issueKey,
              context.signal,
            );
            const descriptionAdf =
              parsed.data.descriptionText !== undefined
                ? plainTextToAdf(parsed.data.descriptionText)
                : undefined;
            const raw = await options.client.updateIssue({
              issueKey: parsed.data.issueKey,
              ...(parsed.data.summary !== undefined
                ? { summary: parsed.data.summary }
                : {}),
              ...(descriptionAdf !== undefined ? { descriptionAdf } : {}),
              signal: context.signal,
            });
            const output =
              raw !== null && typeof raw === "object"
                ? { updated: true as const, issueKey: parsed.data.issueKey }
                : { updated: true as const, issueKey: parsed.data.issueKey };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential, true);
          }
        },
      }),
      defineTool({
        name: JIRA_ISSUE_COMMENT_CREATE_TOOL,
        description:
          "Adds a comment to an issue (mutating). Body is sent as ADF. Requires write flags. No connector-level retries.",
        inputSchema: issueCommentCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueCommentCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          assertMutationsProjectAllowlistReady(allowlist);
          try {
            await assertIssueProjectAllowed(
              options.client,
              allowlist,
              parsed.data.issueKey,
              context.signal,
            );
            const bodyAdf = plainTextToAdf(parsed.data.bodyText);
            const raw = await options.client.createIssueComment({
              issueKey: parsed.data.issueKey,
              bodyAdf,
              signal: context.signal,
            });
            const record =
              raw !== null && typeof raw === "object"
                ? (raw as Record<string, unknown>)
                : {};
            const id = typeof record.id === "string" ? record.id : undefined;
            const output = {
              ...(id !== undefined ? { id } : {}),
              issueKey: parsed.data.issueKey,
              created: true as const,
            };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential, true);
          }
        },
      }),
      defineTool({
        name: JIRA_ISSUE_TRANSITION_TOOL,
        description:
          "Executes a workflow transition on an issue (mutating). Requires write flags. No connector-level retries.",
        inputSchema: issueTransitionInputJsonSchema,
        handler: async (input, context) => {
          const parsed = issueTransitionInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          assertMutationsProjectAllowlistReady(allowlist);
          try {
            await assertIssueProjectAllowed(
              options.client,
              allowlist,
              parsed.data.issueKey,
              context.signal,
            );
            await options.client.transitionIssue({
              issueKey: parsed.data.issueKey,
              transitionId: parsed.data.transitionId,
              signal: context.signal,
            });
            const output = {
              issueKey: parsed.data.issueKey,
              transitionId: parsed.data.transitionId,
              transitioned: true as const,
            };
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
