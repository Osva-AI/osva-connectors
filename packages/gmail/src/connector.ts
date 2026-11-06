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
  GMAIL_DRAFT_CREATE_TOOL,
  GMAIL_DRAFT_LIST_TOOL,
  GMAIL_DRAFT_UPDATE_TOOL,
  GMAIL_LABEL_LIST_TOOL,
  GMAIL_MESSAGE_GET_TOOL,
  GMAIL_MESSAGE_LIST_TOOL,
  GMAIL_MESSAGE_SEND_TOOL,
  GMAIL_PROFILE_GET_TOOL,
  GMAIL_THREAD_GET_TOOL,
  GMAIL_THREAD_LIST_TOOL,
} from "./constants.js";
import type { GmailClient } from "./gmail-client.js";
import { mapGmailError } from "./map-gmail-error.js";
import {
  mapDraftCreateOrUpdateResponse,
  mapDraftListResponse,
  mapLabelsResponse,
  mapMessageGetResponse,
  mapMessageListResponse,
  mapProfileResponse,
  mapSendMessageResponse,
  mapThreadGetResponse,
  mapThreadListResponse,
} from "./normalize-gmail.js";
import { assertStructuredOutputWithinBudget } from "./output-budget.js";
import type { GmailConfig } from "./schemas.js";
import {
  assertDraftsEnabled,
  assertRecipientsAllowedByHostPolicy,
  assertSendEnabledAndApproved,
  buildGmailRawFromParts,
} from "./send-policy.js";
import {
  collectRecipientEmails,
  draftCreateInputJsonSchema,
  draftCreateInputSchema,
  draftListInputJsonSchema,
  draftListInputSchema,
  draftUpdateInputJsonSchema,
  draftUpdateInputSchema,
  labelListInputJsonSchema,
  labelListInputSchema,
  messageGetInputJsonSchema,
  messageGetInputSchema,
  messageListInputJsonSchema,
  messageListInputSchema,
  messageSendInputJsonSchema,
  messageSendInputSchema,
  profileGetInputJsonSchema,
  profileGetInputSchema,
  threadGetInputJsonSchema,
  threadGetInputSchema,
  threadListInputJsonSchema,
  threadListInputSchema,
} from "./tool-schemas.js";

export interface CreateGmailConnectorOptions {
  readonly client: GmailClient;
  readonly config: GmailConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
  ambiguousMutation?: boolean,
): ConnectorSdkError {
  return mapGmailError(error, {
    ...(accessTokenForRedaction !== undefined
      ? { accessToken: accessTokenForRedaction }
      : {}),
    ...(ambiguousMutation === true ? { ambiguousMutation: true } : {}),
  });
}

export function createGmailConnector(
  options: CreateGmailConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const redact = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Gmail MCP connector for OSVA Connector Profile V1: bounded mailbox reads, label listing, and controlled drafts/sends when explicitly enabled and host-approved. Supports Application Default Credentials, a static OAuth access token from the host, or service-account domain-wide delegation when configured. Email content and headers are untrusted external data. Sends are non-idempotent — the connector does not retry them automatically.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: GMAIL_PROFILE_GET_TOOL,
        description:
          "Returns the Gmail user profile (email address, counts, history ID).",
        inputSchema: profileGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = profileGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getProfile({
              signal: context.signal,
            });
            const result = mapProfileResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: GMAIL_MESSAGE_LIST_TOOL,
        description:
          "Lists message IDs with bounded pagination (users.messages.list).",
        inputSchema: messageListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = messageListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listMessages({
              maxResults: parsed.data.pageSize,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              ...(parsed.data.labelIds !== undefined
                ? { labelIds: parsed.data.labelIds }
                : {}),
              ...(parsed.data.query !== undefined
                ? { q: parsed.data.query }
                : {}),
              ...(parsed.data.includeSpamTrash === true
                ? { includeSpamTrash: true }
                : {}),
              signal: context.signal,
            });
            const result = mapMessageListResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: GMAIL_MESSAGE_GET_TOOL,
        description:
          "Gets a message (minimal, metadata, or full plain-text body). Untrusted content.",
        inputSchema: messageGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = messageGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getMessage({
              messageId: parsed.data.messageId,
              format: parsed.data.format,
              ...(parsed.data.metadataHeaders !== undefined
                ? { metadataHeaders: parsed.data.metadataHeaders }
                : {}),
              signal: context.signal,
            });
            const result = mapMessageGetResponse(raw, {
              format: parsed.data.format,
            });
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: GMAIL_THREAD_LIST_TOOL,
        description:
          "Lists thread IDs with bounded pagination (users.threads.list). Snippets are untrusted.",
        inputSchema: threadListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = threadListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listThreads({
              maxResults: parsed.data.pageSize,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              ...(parsed.data.labelIds !== undefined
                ? { labelIds: parsed.data.labelIds }
                : {}),
              ...(parsed.data.query !== undefined
                ? { q: parsed.data.query }
                : {}),
              ...(parsed.data.includeSpamTrash === true
                ? { includeSpamTrash: true }
                : {}),
              signal: context.signal,
            });
            const result = mapThreadListResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: GMAIL_THREAD_GET_TOOL,
        description:
          "Gets a thread with optional per-message detail. Full format includes plain-text bodies (untrusted).",
        inputSchema: threadGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = threadGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getThread({
              threadId: parsed.data.threadId,
              format: parsed.data.format,
              ...(parsed.data.metadataHeaders !== undefined
                ? { metadataHeaders: parsed.data.metadataHeaders }
                : {}),
              signal: context.signal,
            });
            const result = mapThreadGetResponse(raw, {
              format: parsed.data.format,
            });
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: GMAIL_LABEL_LIST_TOOL,
        description: "Lists labels in the mailbox (users.labels.list).",
        inputSchema: labelListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = labelListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listLabels({
              signal: context.signal,
            });
            const result = mapLabelsResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: GMAIL_DRAFT_LIST_TOOL,
        description:
          "Lists drafts with bounded pagination (users.drafts.list).",
        inputSchema: draftListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = draftListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listDrafts({
              maxResults: parsed.data.pageSize,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              signal: context.signal,
            });
            const result = mapDraftListResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: GMAIL_DRAFT_CREATE_TOOL,
        description:
          "Creates a plain-text draft (users.drafts.create). Requires OSVA_CONNECTOR_GMAIL_DRAFTS_ENABLED and host allowlisted recipients. No attachments.",
        inputSchema: draftCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = draftCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertDraftsEnabled(config);
            assertRecipientsAllowedByHostPolicy(
              collectRecipientEmails(parsed.data.message),
              config,
            );
            const { raw } = buildGmailRawFromParts({
              to: parsed.data.message.to,
              ...(parsed.data.message.cc !== undefined
                ? { cc: parsed.data.message.cc }
                : {}),
              ...(parsed.data.message.bcc !== undefined
                ? { bcc: parsed.data.message.bcc }
                : {}),
              subject: parsed.data.message.subject,
              bodyPlain: parsed.data.message.bodyPlain,
            });
            const rawResponse = await options.client.createDraft({
              body: { message: { raw } },
              signal: context.signal,
            });
            const result = mapDraftCreateOrUpdateResponse(rawResponse);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),

      defineTool({
        name: GMAIL_DRAFT_UPDATE_TOOL,
        description:
          "Updates a draft by ID (users.drafts.update). Same policy as draft create.",
        inputSchema: draftUpdateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = draftUpdateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertDraftsEnabled(config);
            assertRecipientsAllowedByHostPolicy(
              collectRecipientEmails(parsed.data.message),
              config,
            );
            const { raw } = buildGmailRawFromParts({
              to: parsed.data.message.to,
              ...(parsed.data.message.cc !== undefined
                ? { cc: parsed.data.message.cc }
                : {}),
              ...(parsed.data.message.bcc !== undefined
                ? { bcc: parsed.data.message.bcc }
                : {}),
              subject: parsed.data.message.subject,
              bodyPlain: parsed.data.message.bodyPlain,
            });
            const rawResponse = await options.client.updateDraft({
              draftId: parsed.data.draftId,
              body: { message: { raw } },
              signal: context.signal,
            });
            const result = mapDraftCreateOrUpdateResponse(rawResponse);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),

      defineTool({
        name: GMAIL_MESSAGE_SEND_TOOL,
        description:
          "Sends a plain-text message (users.messages.send). Requires OSVA_CONNECTOR_GMAIL_SEND_ENABLED, OSVA_CONNECTOR_GMAIL_HOST_SEND_APPROVED, and allowlisted recipients. Non-idempotent — not retried automatically.",
        inputSchema: messageSendInputJsonSchema,
        handler: async (input, context) => {
          const parsed = messageSendInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertSendEnabledAndApproved(config);
            assertRecipientsAllowedByHostPolicy(
              collectRecipientEmails(parsed.data.message),
              config,
            );
            const { raw } = buildGmailRawFromParts({
              to: parsed.data.message.to,
              ...(parsed.data.message.cc !== undefined
                ? { cc: parsed.data.message.cc }
                : {}),
              ...(parsed.data.message.bcc !== undefined
                ? { bcc: parsed.data.message.bcc }
                : {}),
              subject: parsed.data.message.subject,
              bodyPlain: parsed.data.message.bodyPlain,
            });
            const rawResponse = await options.client.sendMessage({
              body: { raw },
              signal: context.signal,
            });
            const result = mapSendMessageResponse(rawResponse);
            assertStructuredOutputWithinBudget(result);
            return { ...result, sendNotRetried: true as const };
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),
    ],
  });
}
