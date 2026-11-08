import {
  ConnectorSdkError,
  defineConnector,
  defineTool,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  SALESFORCE_ACCOUNT_GET_TOOL,
  SALESFORCE_ACCOUNT_LIST_TOOL,
  SALESFORCE_ALLOWED_OPPORTUNITY_IDS_ENV,
  SALESFORCE_ALLOWED_TASK_PARENT_IDS_ENV,
  SALESFORCE_CONTACT_GET_TOOL,
  SALESFORCE_CONTACT_LIST_TOOL,
  SALESFORCE_OPPORTUNITY_GET_TOOL,
  SALESFORCE_OPPORTUNITY_LIST_TOOL,
  SALESFORCE_OPPORTUNITY_STAGE_LIST_TOOL,
  SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL,
  SALESFORCE_TASK_CREATE_TOOL,
} from "./constants.js";
import {
  assertIdAllowed,
  assertMutationAllowlistConfigured,
  createStringIdAllowlist,
  filterByStringAllowlist,
} from "./id-allowlist.js";
import { mapSalesforceError } from "./map-salesforce-error.js";
import {
  buildOpportunityStagePatchBody,
  buildTaskCreateBody,
} from "./mutation-allowlist.js";
import {
  defaultListPerPage,
  mapOpportunityStageListResponse,
  mapQueryListResponse,
  mapRecordGetResponse,
  splitQueryResponseEnvelope,
} from "./normalize-salesforce.js";
import type { SalesforceClient } from "./salesforce-client.js";
import type { SalesforceConfig } from "./schemas.js";
import {
  accountGetInputJsonSchema,
  accountGetInputSchema,
  accountListInputJsonSchema,
  accountListInputSchema,
  contactGetInputJsonSchema,
  contactGetInputSchema,
  contactListInputJsonSchema,
  contactListInputSchema,
  opportunityGetInputJsonSchema,
  opportunityGetInputSchema,
  opportunityListInputJsonSchema,
  opportunityListInputSchema,
  opportunityStageListInputJsonSchema,
  opportunityStageListInputSchema,
  opportunityStageSetInputJsonSchema,
  opportunityStageSetInputSchema,
  taskCreateInputJsonSchema,
  taskCreateInputSchema,
} from "./tool-schemas.js";

export interface CreateSalesforceConnectorOptions {
  readonly client: SalesforceClient;
  readonly config: SalesforceConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError() {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  options: CreateSalesforceConnectorOptions,
  ambiguous?: boolean,
) {
  return mapSalesforceError(error, {
    accessToken: options.accessTokenForRedaction,
    ...(ambiguous === true ? { ambiguousWrite: true } : {}),
  });
}

function assertStageUpdatesAllowed(config: SalesforceConfig): void {
  if (!config.stageUpdatesEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Salesforce opportunity stage updates are disabled (STAGE_UPDATES_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Salesforce mutations require HOST_WRITES_APPROVED.",
    );
  }
}

function assertTasksAllowed(config: SalesforceConfig): void {
  if (!config.tasksEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Salesforce task creation is disabled (TASKS_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Salesforce mutations require HOST_WRITES_APPROVED.",
    );
  }
}

function readOpportunityId(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";
  const id =
    (raw as { Id?: unknown }).Id ??
    (raw as { id?: unknown }).id ??
    (raw as Record<string, unknown>).id;
  return id === undefined ? "" : String(id);
}

export function createSalesforceConnector(
  options: CreateSalesforceConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const opportunityAllowlist = createStringIdAllowlist(
    config.allowedOpportunityIds,
  );
  const taskParentAllowlist = createStringIdAllowlist(
    config.allowedTaskParentIds,
  );

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Salesforce MCP connector: bounded CRM reads, opportunity stage updates, and task creation.",
    tools: [
      defineTool({
        name: SALESFORCE_ACCOUNT_LIST_TOOL,
        inputSchema: accountListInputJsonSchema,
        description: "Lists Salesforce accounts with bounded pagination.",
        handler: async (input, context) => {
          const parsed = accountListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const perPage = defaultListPerPage(
            "perPage" in parsed.data ? parsed.data.perPage : undefined,
          );
          try {
            const raw = await client.listAccounts(
              {
                perPage,
                ...("continuationToken" in parsed.data
                  ? { continuationToken: parsed.data.continuationToken }
                  : {
                      filters: {
                        accountId: parsed.data.accountId,
                      },
                    }),
              },
              context.signal,
            );
            const { body, continuationToken } = splitQueryResponseEnvelope(raw);
            return mapQueryListResponse(
              body,
              config.includePii,
              "accounts",
              continuationToken,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SALESFORCE_ACCOUNT_GET_TOOL,
        inputSchema: accountGetInputJsonSchema,
        description: "Returns one Salesforce account.",
        handler: async (input, context) => {
          const parsed = accountGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          try {
            return mapRecordGetResponse(
              await client.getAccount(parsed.data.accountId, context.signal),
              config.includePii,
              "account",
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SALESFORCE_CONTACT_LIST_TOOL,
        inputSchema: contactListInputJsonSchema,
        description: "Lists Salesforce contacts with bounded pagination.",
        handler: async (input, context) => {
          const parsed = contactListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const perPage = defaultListPerPage(
            "perPage" in parsed.data ? parsed.data.perPage : undefined,
          );
          try {
            const raw = await client.listContacts(
              {
                perPage,
                ...("continuationToken" in parsed.data
                  ? { continuationToken: parsed.data.continuationToken }
                  : {
                      filters: { accountId: parsed.data.accountId },
                    }),
              },
              context.signal,
            );
            const { body, continuationToken } = splitQueryResponseEnvelope(raw);
            return mapQueryListResponse(
              body,
              config.includePii,
              "contacts",
              continuationToken,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SALESFORCE_CONTACT_GET_TOOL,
        inputSchema: contactGetInputJsonSchema,
        description: "Returns one Salesforce contact.",
        handler: async (input, context) => {
          const parsed = contactGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          try {
            return mapRecordGetResponse(
              await client.getContact(parsed.data.contactId, context.signal),
              config.includePii,
              "contact",
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SALESFORCE_OPPORTUNITY_LIST_TOOL,
        inputSchema: opportunityListInputJsonSchema,
        description: "Lists Salesforce opportunities with bounded pagination.",
        handler: async (input, context) => {
          const parsed = opportunityListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (opportunityAllowlist?.allowedIds.size === 0) {
            return {
              pageInfo: { hasMore: false },
              opportunities: [],
              untrustedContent: true as const,
            };
          }
          const perPage = defaultListPerPage(
            "perPage" in parsed.data ? parsed.data.perPage : undefined,
          );
          try {
            const raw = await client.listOpportunities(
              {
                perPage,
                ...("continuationToken" in parsed.data
                  ? { continuationToken: parsed.data.continuationToken }
                  : {
                      filters: {
                        accountId: parsed.data.accountId,
                        stage: parsed.data.stage,
                        updatedSince: parsed.data.updatedSince,
                        closeDateFrom: parsed.data.closeDateFrom,
                        closeDateTo: parsed.data.closeDateTo,
                      },
                    }),
              },
              context.signal,
            );
            const { body, continuationToken } = splitQueryResponseEnvelope(raw);
            const mapped = mapQueryListResponse(
              body,
              config.includePii,
              "opportunities",
              continuationToken,
            );
            const opportunities = filterByStringAllowlist(
              opportunityAllowlist,
              (mapped.opportunities as unknown[]) ?? [],
              (row) =>
                typeof row === "object" && row !== null
                  ? readOpportunityId(row)
                  : "",
            );
            return { ...mapped, opportunities };
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SALESFORCE_OPPORTUNITY_GET_TOOL,
        inputSchema: opportunityGetInputJsonSchema,
        description: "Returns one Salesforce opportunity.",
        handler: async (input, context) => {
          const parsed = opportunityGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(
            opportunityAllowlist,
            parsed.data.opportunityId,
            "Opportunity",
          );
          try {
            return mapRecordGetResponse(
              await client.getOpportunity(
                parsed.data.opportunityId,
                context.signal,
              ),
              config.includePii,
              "opportunity",
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SALESFORCE_OPPORTUNITY_STAGE_LIST_TOOL,
        inputSchema: opportunityStageListInputJsonSchema,
        description: "Lists Salesforce opportunity stages.",
        handler: async (input, context) => {
          const parsed = opportunityStageListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          try {
            return mapOpportunityStageListResponse(
              await client.listOpportunityStages(context.signal),
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL,
        inputSchema: opportunityStageSetInputJsonSchema,
        description:
          "Updates opportunity stage. Requires STAGE_UPDATES_ENABLED and allowlist.",
        handler: async (input, context) => {
          assertStageUpdatesAllowed(config);
          assertMutationAllowlistConfigured(
            opportunityAllowlist,
            SALESFORCE_ALLOWED_OPPORTUNITY_IDS_ENV,
          );
          const parsed = opportunityStageSetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(
            opportunityAllowlist,
            parsed.data.opportunityId,
            "Opportunity",
          );
          const body = buildOpportunityStagePatchBody(
            parsed.data.targetStage,
            config.allowedTargetStages,
          );
          try {
            await client.setOpportunityStage(
              parsed.data.opportunityId,
              body,
              context.signal,
            );
            return {
              opportunityId: parsed.data.opportunityId,
              targetStage: parsed.data.targetStage,
              updated: true as const,
            };
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
      defineTool({
        name: SALESFORCE_TASK_CREATE_TOOL,
        inputSchema: taskCreateInputJsonSchema,
        description:
          "Creates a Salesforce task on an allowlisted Account, Opportunity, or Contact. Requires TASKS_ENABLED.",
        handler: async (input, context) => {
          assertTasksAllowed(config);
          assertMutationAllowlistConfigured(
            taskParentAllowlist,
            SALESFORCE_ALLOWED_TASK_PARENT_IDS_ENV,
          );
          const parsed = taskCreateInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(
            taskParentAllowlist,
            parsed.data.relatedRecordId,
            "Related record",
          );
          const body = buildTaskCreateBody({
            subject: parsed.data.subject,
            relatedRecordType: parsed.data.relatedRecordType,
            relatedRecordId: parsed.data.relatedRecordId,
            dueDate: parsed.data.dueDate,
          });
          try {
            const raw = await client.createTask(body, context.signal);
            const taskId =
              typeof raw === "object" &&
              raw !== null &&
              (raw as { id?: unknown }).id !== undefined
                ? String((raw as { id: unknown }).id)
                : undefined;
            return {
              relatedRecordId: parsed.data.relatedRecordId,
              relatedRecordType: parsed.data.relatedRecordType,
              created: true as const,
              ...(taskId !== undefined ? { taskId } : {}),
            };
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
    ],
  });
}
