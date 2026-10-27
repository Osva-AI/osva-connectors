import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  validateAnalyticsDateRange,
  validateAnalyticsMetrics,
} from "./analytics-allowlist.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  WHATSAPP_ANALYTICS_GET_TOOL,
  WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL,
  WHATSAPP_BUSINESS_PROFILE_GET_TOOL,
  WHATSAPP_PHONE_NUMBER_GET_TOOL,
  WHATSAPP_PHONE_NUMBER_LIST_TOOL,
  WHATSAPP_TEMPLATE_GET_TOOL,
  WHATSAPP_TEMPLATE_LIST_TOOL,
  WHATSAPP_TEMPLATE_SEND_TOOL,
} from "./constants.js";
import { mapWhatsAppError } from "./map-whatsapp-error.js";
import { mapTemplateAnalyticsResponse } from "./normalize-analytics.js";
import {
  mapBusinessAccountGetResponse,
  mapBusinessProfileGetResponse,
  mapPhoneNumberGetResponse,
  mapPhoneNumberListResponse,
} from "./normalize-resources.js";
import {
  extractTemplateMetadata,
  mapTemplateGetResponse,
  mapTemplateListResponse,
  mapTemplateSendResponse,
} from "./normalize-templates.js";
import { resolvePhoneNumberId, resolveWabaId } from "./resolve-assets.js";
import type { WhatsAppConfig } from "./schemas.js";
import {
  assertRecipientAllowedByHostPolicy,
  assertTemplateEligibleForSend,
  assertTemplateSendEnabled,
  countBodyPlaceholders,
} from "./send-policy.js";
import {
  analyticsGetInputJsonSchema,
  analyticsGetInputSchema,
  businessAccountGetInputJsonSchema,
  businessAccountGetInputSchema,
  businessProfileGetInputJsonSchema,
  businessProfileGetInputSchema,
  phoneNumberGetInputJsonSchema,
  phoneNumberGetInputSchema,
  phoneNumberListInputJsonSchema,
  phoneNumberListInputSchema,
  templateGetInputJsonSchema,
  templateGetInputSchema,
  templateListInputJsonSchema,
  templateListInputSchema,
  templateSendInputJsonSchema,
  templateSendInputSchema,
} from "./tool-schemas.js";
import { fetchGraphListBounded } from "./whatsapp-list-fetch.js";
import type { WhatsAppGraphClient } from "./whatsapp-graph-client.js";

const WABA_GET_FIELDS = [
  "id",
  "name",
  "timezone_id",
  "message_template_namespace",
  "account_review_status",
  "business_verification_status",
] as const;

const PHONE_NUMBER_FIELDS = [
  "id",
  "display_phone_number",
  "verified_name",
  "code_verification_status",
  "quality_rating",
  "messaging_limit_tier",
  "status",
] as const;

const BUSINESS_PROFILE_FIELDS = [
  "about",
  "address",
  "description",
  "email",
  "websites",
  "vertical",
] as const;

const TEMPLATE_LIST_FIELDS = [
  "id",
  "name",
  "language",
  "status",
  "category",
] as const;

const TEMPLATE_GET_FIELDS = [...TEMPLATE_LIST_FIELDS, "components"] as const;

export interface CreateWhatsAppConnectorOptions {
  readonly client: WhatsAppGraphClient;
  readonly config: WhatsAppConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
  ambiguousSend?: boolean,
): ConnectorSdkError {
  return mapWhatsAppError(error, {
    accessToken: accessTokenForRedaction,
    ...(ambiguousSend === true ? { ambiguousSend: true } : {}),
  });
}

export function createWhatsAppConnector(
  options: CreateWhatsAppConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const maxRows = config.maxRows;
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "WhatsApp Business Cloud API connector for OSVA Connector Profile V1 (WABA and phone discovery, business profile, templates, template analytics, and host-guarded template send). Requires a Meta system-user or user token with whatsapp_business_management and whatsapp_business_messaging as applicable. Inbound messages and delivery statuses are webhook-driven and are not retrieved by this package.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: WHATSAPP_BUSINESS_ACCOUNT_GET_TOOL,
        description:
          "Returns WhatsApp Business Account metadata for the configured WABA (whatsapp_business_management).",
        inputSchema: businessAccountGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = businessAccountGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const wabaId = resolveWabaId(parsed.data.wabaId, config);
          try {
            const raw = await options.client.getNode({
              path: wabaId,
              fields: WABA_GET_FIELDS,
              signal: context.signal,
            });
            return mapBusinessAccountGetResponse(raw, wabaId);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: WHATSAPP_PHONE_NUMBER_LIST_TOOL,
        description:
          "Lists phone numbers registered on the WABA (whatsapp_business_management).",
        inputSchema: phoneNumberListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = phoneNumberListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const wabaId = resolveWabaId(parsed.data.wabaId, config);
          const limit = Math.min(parsed.data.limit, maxRows);
          try {
            const fetched = await fetchGraphListBounded({
              client: options.client,
              path: `${wabaId}/phone_numbers`,
              fields: PHONE_NUMBER_FIELDS,
              limit,
              ...(parsed.data.after !== undefined
                ? { after: parsed.data.after }
                : {}),
              signal: context.signal,
            });
            return mapPhoneNumberListResponse(fetched.rows, {
              allowedPhoneNumberIds: config.allowedPhoneNumberIds,
              ...(fetched.nextCursor !== undefined
                ? { nextCursor: fetched.nextCursor }
                : {}),
              pagesFetched: fetched.pagesFetched,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: WHATSAPP_PHONE_NUMBER_GET_TOOL,
        description:
          "Returns metadata for a configured business phone number (whatsapp_business_management).",
        inputSchema: phoneNumberGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = phoneNumberGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const phoneNumberId = resolvePhoneNumberId(
            parsed.data.phoneNumberId,
            config,
          );
          try {
            const raw = await options.client.getNode({
              path: phoneNumberId,
              fields: PHONE_NUMBER_FIELDS,
              signal: context.signal,
            });
            return mapPhoneNumberGetResponse(raw, phoneNumberId);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: WHATSAPP_BUSINESS_PROFILE_GET_TOOL,
        description:
          "Returns WhatsApp business profile fields for a phone number (whatsapp_business_management).",
        inputSchema: businessProfileGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = businessProfileGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const phoneNumberId = resolvePhoneNumberId(
            parsed.data.phoneNumberId,
            config,
          );
          try {
            const raw = await options.client.getNode({
              path: `${phoneNumberId}/whatsapp_business_profile`,
              fields: BUSINESS_PROFILE_FIELDS,
              signal: context.signal,
            });
            return mapBusinessProfileGetResponse(raw, phoneNumberId);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: WHATSAPP_TEMPLATE_LIST_TOOL,
        description:
          "Lists message templates on the WABA (whatsapp_business_management).",
        inputSchema: templateListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = templateListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const wabaId = resolveWabaId(parsed.data.wabaId, config);
          const limit = Math.min(parsed.data.limit, maxRows);
          try {
            const fetched = await fetchGraphListBounded({
              client: options.client,
              path: `${wabaId}/message_templates`,
              fields: TEMPLATE_LIST_FIELDS,
              limit,
              ...(parsed.data.after !== undefined
                ? { after: parsed.data.after }
                : {}),
              signal: context.signal,
            });
            return mapTemplateListResponse(fetched.rows, {
              ...(fetched.nextCursor !== undefined
                ? { nextCursor: fetched.nextCursor }
                : {}),
              pagesFetched: fetched.pagesFetched,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: WHATSAPP_TEMPLATE_GET_TOOL,
        description:
          "Returns a message template by ID (whatsapp_business_management).",
        inputSchema: templateGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = templateGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getNode({
              path: parsed.data.templateId,
              fields: TEMPLATE_GET_FIELDS,
              signal: context.signal,
            });
            return mapTemplateGetResponse(raw, parsed.data.templateId);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: WHATSAPP_ANALYTICS_GET_TOOL,
        description:
          "Returns WABA template analytics (GET template_analytics, DAILY granularity, CLOUD_API). Requires prior template analytics confirmation on the WABA.",
        inputSchema: analyticsGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = analyticsGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const wabaId = resolveWabaId(parsed.data.wabaId, config);
          validateAnalyticsDateRange(
            parsed.data.startDate,
            parsed.data.endDate,
          );
          const metricTypes = validateAnalyticsMetrics(parsed.data.metricTypes);
          try {
            const raw = await options.client.getTemplateAnalytics({
              wabaId,
              startDate: parsed.data.startDate,
              endDate: parsed.data.endDate,
              templateIds: parsed.data.templateIds,
              metricTypes,
              useWabaTimezone: parsed.data.useWabaTimezone,
              signal: context.signal,
            });
            return mapTemplateAnalyticsResponse(raw, {
              wabaId,
              startDate: parsed.data.startDate,
              endDate: parsed.data.endDate,
              templateIds: parsed.data.templateIds,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: WHATSAPP_TEMPLATE_SEND_TOOL,
        description:
          "**External side effect:** sends one approved template message to a single recipient (POST /messages). Disabled unless OSVA_CONNECTOR_WHATSAPP_SEND_ENABLED=true and recipient appears in OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS (host-verified opt-in). No OTP/authentication templates. Does not confirm delivery—use webhooks.",
        inputSchema: templateSendInputJsonSchema,
        handler: async (input, context) => {
          const parsed = templateSendInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }

          assertTemplateSendEnabled(config);
          const recipient = assertRecipientAllowedByHostPolicy(
            parsed.data.recipient,
            config,
          );
          const phoneNumberId = resolvePhoneNumberId(
            parsed.data.phoneNumberId,
            config,
          );

          try {
            const listed = await fetchGraphListBounded({
              client: options.client,
              path: `${config.wabaId}/message_templates`,
              fields: TEMPLATE_GET_FIELDS,
              limit: 25,
              extraQuery: { name: parsed.data.templateName },
              signal: context.signal,
            });

            const match = listed.rows.find((row) => {
              if (row === null || typeof row !== "object") {
                return false;
              }
              const record = row as Record<string, unknown>;
              return (
                record.name === parsed.data.templateName &&
                record.language === parsed.data.languageCode
              );
            });

            if (match === undefined) {
              throw new ConnectorSdkError(
                "NOT_FOUND",
                "Approved template name and language were not found on this WABA.",
              );
            }

            const meta = extractTemplateMetadata(match);
            assertTemplateEligibleForSend(meta);
            if (meta.language !== parsed.data.languageCode) {
              throw new ConnectorSdkError(
                "INVALID_INPUT",
                "Template language does not match the requested locale.",
              );
            }

            const placeholders = countBodyPlaceholders(meta.components);
            if (parsed.data.bodyParameters.length !== placeholders) {
              throw new ConnectorSdkError(
                "INVALID_INPUT",
                "Body parameter count does not match the template definition.",
              );
            }

            const raw = await options.client.sendTemplateMessage({
              phoneNumberId,
              recipientE164: recipient,
              templateName: parsed.data.templateName,
              languageCode: parsed.data.languageCode,
              bodyParameters: parsed.data.bodyParameters,
              signal: context.signal,
            });
            return mapTemplateSendResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken, true);
          }
        },
      }),
    ],
  });
}
