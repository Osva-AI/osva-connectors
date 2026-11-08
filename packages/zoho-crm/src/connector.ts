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
  LIST_DEFAULT_PAGE,
  LIST_DEFAULT_PER_PAGE,
  ZOHO_ACCOUNT_GET_TOOL,
  ZOHO_ACCOUNT_LIST_TOOL,
  ZOHO_ALLOWED_DEAL_IDS_ENV,
  ZOHO_CONTACT_GET_TOOL,
  ZOHO_CONTACT_LIST_TOOL,
  ZOHO_DEAL_GET_TOOL,
  ZOHO_DEAL_LIST_TOOL,
  ZOHO_DEAL_NOTE_ADD_TOOL,
  ZOHO_DEAL_STAGE_LIST_TOOL,
  ZOHO_DEAL_STAGE_SET_TOOL,
  ZOHO_LEAD_GET_TOOL,
  ZOHO_LEAD_LIST_TOOL,
} from "./constants.js";
import {
  assertIdAllowed,
  assertMutationAllowlistConfigured,
  createStringIdAllowlist,
  filterByStringAllowlist,
} from "./id-allowlist.js";
import { mapZohoError } from "./map-zoho-error.js";
import {
  buildZohoDealNoteBody,
  buildZohoDealStageBody,
} from "./mutation-allowlist.js";
import {
  mapDealStageListResponse,
  mapRecordGetResponse,
  mapRecordListResponse,
  readDealIdFromRecord,
  ZOHO_MODULE_FIELDS,
} from "./normalize-zoho.js";
import type { ZohoConfig } from "./schemas.js";
import type { ZohoClient } from "./zoho-client.js";
import {
  accountGetInputJsonSchema,
  accountGetInputSchema,
  accountListInputJsonSchema,
  accountListInputSchema,
  contactGetInputJsonSchema,
  contactGetInputSchema,
  contactListInputJsonSchema,
  contactListInputSchema,
  dealGetInputJsonSchema,
  dealGetInputSchema,
  dealListInputJsonSchema,
  dealListInputSchema,
  dealNoteAddInputJsonSchema,
  dealNoteAddInputSchema,
  dealStageListInputJsonSchema,
  dealStageListInputSchema,
  dealStageSetInputJsonSchema,
  dealStageSetInputSchema,
  leadGetInputJsonSchema,
  leadGetInputSchema,
  leadListInputJsonSchema,
  leadListInputSchema,
} from "./tool-schemas.js";

export interface CreateZohoConnectorOptions {
  readonly client: ZohoClient;
  readonly config: ZohoConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError() {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  options: CreateZohoConnectorOptions,
  ambiguous?: boolean,
) {
  return mapZohoError(error, {
    accessToken: options.accessTokenForRedaction,
    ...(ambiguous === true ? { ambiguousWrite: true } : {}),
  });
}

function assertNotesAllowed(config: ZohoConfig): void {
  if (!config.notesEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Zoho CRM note adds are disabled (NOTES_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Zoho CRM mutations require HOST_WRITES_APPROVED.",
    );
  }
}

function assertStageAllowed(config: ZohoConfig): void {
  if (!config.stageUpdatesEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Zoho CRM stage updates are disabled (STAGE_UPDATES_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Zoho CRM mutations require HOST_WRITES_APPROVED.",
    );
  }
}

export function createZohoConnector(
  options: CreateZohoConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const dealAllowlist = createStringIdAllowlist(config.allowedDealIds);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Zoho CRM MCP connector: bounded lead/account/contact/deal reads, deal stage updates, and internal notes. Notes are never shared to the client portal.",
    tools: [
      defineTool({
        name: ZOHO_LEAD_LIST_TOOL,
        inputSchema: leadListInputJsonSchema,
        description: "Lists Zoho CRM leads with bounded pagination.",
        handler: async (input, context) => {
          const parsed = leadListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          const perPage = parsed.data.perPage ?? LIST_DEFAULT_PER_PAGE;
          const fields = ZOHO_MODULE_FIELDS.Leads;
          try {
            const raw = await client.listLeads(
              { page, perPage },
              context.signal,
            );
            return mapRecordListResponse(
              "Leads",
              raw,
              page,
              perPage,
              config.includePii,
              fields.nameKey,
              fields.emailKey,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_LEAD_GET_TOOL,
        inputSchema: leadGetInputJsonSchema,
        description: "Returns one Zoho CRM lead.",
        handler: async (input, context) => {
          const parsed = leadGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const fields = ZOHO_MODULE_FIELDS.Leads;
          try {
            const raw = await client.getLead(
              parsed.data.leadId,
              context.signal,
            );
            return mapRecordGetResponse(
              "Leads",
              raw,
              config.includePii,
              fields.nameKey,
              fields.emailKey,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_ACCOUNT_LIST_TOOL,
        inputSchema: accountListInputJsonSchema,
        description: "Lists Zoho CRM accounts with bounded pagination.",
        handler: async (input, context) => {
          const parsed = accountListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          const perPage = parsed.data.perPage ?? LIST_DEFAULT_PER_PAGE;
          const fields = ZOHO_MODULE_FIELDS.Accounts;
          try {
            const raw = await client.listAccounts(
              { page, perPage },
              context.signal,
            );
            return mapRecordListResponse(
              "Accounts",
              raw,
              page,
              perPage,
              config.includePii,
              fields.nameKey,
              fields.emailKey,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_ACCOUNT_GET_TOOL,
        inputSchema: accountGetInputJsonSchema,
        description: "Returns one Zoho CRM account.",
        handler: async (input, context) => {
          const parsed = accountGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const fields = ZOHO_MODULE_FIELDS.Accounts;
          try {
            const raw = await client.getAccount(
              parsed.data.accountId,
              context.signal,
            );
            return mapRecordGetResponse(
              "Accounts",
              raw,
              config.includePii,
              fields.nameKey,
              fields.emailKey,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_CONTACT_LIST_TOOL,
        inputSchema: contactListInputJsonSchema,
        description: "Lists Zoho CRM contacts with bounded pagination.",
        handler: async (input, context) => {
          const parsed = contactListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          const perPage = parsed.data.perPage ?? LIST_DEFAULT_PER_PAGE;
          const fields = ZOHO_MODULE_FIELDS.Contacts;
          try {
            const raw = await client.listContacts(
              { page, perPage },
              context.signal,
            );
            return mapRecordListResponse(
              "Contacts",
              raw,
              page,
              perPage,
              config.includePii,
              fields.nameKey,
              fields.emailKey,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_CONTACT_GET_TOOL,
        inputSchema: contactGetInputJsonSchema,
        description: "Returns one Zoho CRM contact.",
        handler: async (input, context) => {
          const parsed = contactGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const fields = ZOHO_MODULE_FIELDS.Contacts;
          try {
            const raw = await client.getContact(
              parsed.data.contactId,
              context.signal,
            );
            return mapRecordGetResponse(
              "Contacts",
              raw,
              config.includePii,
              fields.nameKey,
              fields.emailKey,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_DEAL_LIST_TOOL,
        inputSchema: dealListInputJsonSchema,
        description:
          "Lists Zoho CRM deals with bounded pagination (optional deal allowlist).",
        handler: async (input, context) => {
          const parsed = dealListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (dealAllowlist?.allowedIds.size === 0) {
            return {
              module: "Deals",
              pageInfo: { page: 1, hasMore: false },
              records: [],
              untrustedContent: true as const,
            };
          }
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          const perPage = parsed.data.perPage ?? LIST_DEFAULT_PER_PAGE;
          const fields = ZOHO_MODULE_FIELDS.Deals;
          try {
            const raw = await client.listDeals(
              { page, perPage },
              context.signal,
            );
            const list =
              typeof raw === "object" &&
              raw !== null &&
              Array.isArray((raw as { data?: unknown }).data)
                ? filterByStringAllowlist(
                    dealAllowlist,
                    (raw as { data: unknown[] }).data,
                    readDealIdFromRecord,
                  )
                : [];
            return mapRecordListResponse(
              "Deals",
              { data: list, info: (raw as { info?: unknown }).info },
              page,
              perPage,
              config.includePii,
              fields.nameKey,
              fields.emailKey,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_DEAL_GET_TOOL,
        inputSchema: dealGetInputJsonSchema,
        description: "Returns one Zoho CRM deal.",
        handler: async (input, context) => {
          const parsed = dealGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(dealAllowlist, parsed.data.dealId, "Deal");
          const fields = ZOHO_MODULE_FIELDS.Deals;
          try {
            const raw = await client.getDeal(
              parsed.data.dealId,
              context.signal,
            );
            return mapRecordGetResponse(
              "Deals",
              raw,
              config.includePii,
              fields.nameKey,
              fields.emailKey,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_DEAL_STAGE_LIST_TOOL,
        inputSchema: dealStageListInputJsonSchema,
        description:
          "Lists allowed deal stage picklist values from Zoho CRM field metadata.",
        handler: async (_input, context) => {
          const parsed = dealStageListInputSchema.safeParse(_input ?? {});
          if (!parsed.success) throw invalidInputError();
          try {
            const raw = await client.listDealStageFields(context.signal);
            return mapDealStageListResponse(raw);
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: ZOHO_DEAL_STAGE_SET_TOOL,
        inputSchema: dealStageSetInputJsonSchema,
        description:
          "Sets a deal stage. Requires STATUS_ENABLED and deal allowlist.",
        handler: async (input, context) => {
          assertStageAllowed(config);
          assertMutationAllowlistConfigured(
            dealAllowlist,
            ZOHO_ALLOWED_DEAL_IDS_ENV,
          );
          const parsed = dealStageSetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(dealAllowlist, parsed.data.dealId, "Deal");
          const body = buildZohoDealStageBody(
            parsed.data.dealId,
            parsed.data.stage,
            config.allowedTargetStages,
          );
          try {
            await client.setDealStage(parsed.data.dealId, body, context.signal);
            return {
              dealId: parsed.data.dealId,
              updated: true as const,
            };
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
      defineTool({
        name: ZOHO_DEAL_NOTE_ADD_TOOL,
        inputSchema: dealNoteAddInputJsonSchema,
        description:
          "Adds an internal deal note (never shared to the client portal). Requires NOTES_ENABLED and allowlist.",
        handler: async (input, context) => {
          assertNotesAllowed(config);
          assertMutationAllowlistConfigured(
            dealAllowlist,
            ZOHO_ALLOWED_DEAL_IDS_ENV,
          );
          const parsed = dealNoteAddInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(dealAllowlist, parsed.data.dealId, "Deal");
          try {
            await client.addDealNote(
              parsed.data.dealId,
              buildZohoDealNoteBody(
                parsed.data.dealId,
                parsed.data.body,
                parsed.data.title,
              ),
              context.signal,
            );
            return {
              dealId: parsed.data.dealId,
              created: true as const,
              portalShared: false as const,
            };
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
    ],
  });
}
