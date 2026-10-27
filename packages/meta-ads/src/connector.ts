import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import { accountIdToApiPath } from "./account-id.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  META_AD_ACCOUNT_GET_TOOL,
  META_AD_ACCOUNT_LIST_TOOL,
  META_AD_LIST_TOOL,
  META_AD_SET_LIST_TOOL,
  META_CAMPAIGN_LIST_TOOL,
  META_INSIGHTS_ACCOUNT_TOOL,
  META_INSIGHTS_AD_SET_TOOL,
  META_INSIGHTS_AD_TOOL,
  META_INSIGHTS_BREAKDOWN_TOOL,
  META_INSIGHTS_CAMPAIGN_TOOL,
} from "./constants.js";
import { validateAttributionWindows } from "./insights-allowlist.js";
import { mapMetaError } from "./map-meta-error.js";
import { fetchInsightsBounded } from "./meta-insights-fetch.js";
import { fetchGraphListBounded } from "./meta-list-fetch.js";
import type { MetaGraphClient } from "./meta-graph-client.js";
import {
  DEFAULT_ATTRIBUTION_NOTE,
  mapInsightsListResponse,
} from "./normalize-insights.js";
import {
  mapAdAccountGetResponse,
  mapAdAccountListResponse,
  mapAdListResponse,
  mapAdSetListResponse,
  mapCampaignListResponse,
} from "./normalize-resources.js";
import { resolveAccountId } from "./resolve-account.js";
import {
  adAccountGetInputJsonSchema,
  adAccountGetInputSchema,
  adAccountListInputJsonSchema,
  adAccountListInputSchema,
  adListInputJsonSchema,
  adListInputSchema,
  adSetListInputJsonSchema,
  adSetListInputSchema,
  campaignListInputJsonSchema,
  campaignListInputSchema,
  insightsAccountInputJsonSchema,
  insightsAccountInputSchema,
  insightsAdInputJsonSchema,
  insightsAdInputSchema,
  insightsAdSetInputJsonSchema,
  insightsAdSetInputSchema,
  insightsBreakdownInputJsonSchema,
  insightsBreakdownInputSchema,
  insightsCampaignInputJsonSchema,
  insightsCampaignInputSchema,
} from "./tool-schemas.js";

const AD_ACCOUNT_LIST_FIELDS = [
  "account_id",
  "name",
  "currency",
  "timezone_name",
  "account_status",
  "amount_spent",
  "disable_reason",
] as const;

const AD_ACCOUNT_GET_FIELDS = [
  ...AD_ACCOUNT_LIST_FIELDS,
  "business_name",
  "created_time",
  "age",
  "spend_cap",
] as const;

const CAMPAIGN_FIELDS = [
  "id",
  "name",
  "objective",
  "status",
  "effective_status",
  "daily_budget",
  "lifetime_budget",
  "buying_type",
] as const;

const AD_SET_FIELDS = [
  "id",
  "name",
  "campaign_id",
  "status",
  "effective_status",
  "daily_budget",
  "lifetime_budget",
  "optimization_goal",
  "billing_event",
  "targeting",
] as const;

const AD_FIELDS = [
  "id",
  "name",
  "campaign_id",
  "adset_id",
  "status",
  "effective_status",
  "creative{id,name}",
] as const;

export interface CreateMetaAdsConnectorOptions {
  readonly client: MetaGraphClient;
  readonly allowedAccountIds?: readonly string[];
  readonly maxRows?: number;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(error: unknown, accessToken?: string): ConnectorSdkError {
  return mapMetaError(error, { accessToken });
}

export function createMetaAdsConnector(
  options: CreateMetaAdsConnectorOptions,
): DefinedConnector {
  const allowedAccountIds = options.allowedAccountIds;
  const configuredMaxRows = options.maxRows ?? 100;
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Meta (Facebook) Marketing API read-only connector for OSVA Connector Profile V1 (ad account discovery, campaign structure, and bounded Insights reporting). Requires a Meta access token with ads_read; account access is enforced by Meta permissions and an optional connector allowlist.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: META_AD_ACCOUNT_LIST_TOOL,
        description:
          "Lists ad accounts accessible to the configured token via me/adaccounts. Results are filtered by the optional OSVA account allowlist.",
        inputSchema: adAccountListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = adAccountListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const limit = Math.min(parsed.data.limit, configuredMaxRows);
            const fetched = await fetchGraphListBounded({
              client: options.client,
              path: "me/adaccounts",
              fields: AD_ACCOUNT_LIST_FIELDS,
              limit,
              ...(parsed.data.cursor !== undefined
                ? { after: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            return mapAdAccountListResponse(fetched.rows, {
              allowedAccountIds,
              nextCursor: fetched.nextCursor,
              pagesFetched: fetched.pagesFetched,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: META_AD_ACCOUNT_GET_TOOL,
        description:
          "Returns metadata for a single ad account. Validates account ID format and optional allowlist.",
        inputSchema: adAccountGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = adAccountGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const accountId = resolveAccountId(
            parsed.data.accountId,
            allowedAccountIds,
          );
          try {
            const raw = await options.client.getNode({
              path: accountIdToApiPath(accountId),
              fields: AD_ACCOUNT_GET_FIELDS,
              signal: context.signal,
            });
            return mapAdAccountGetResponse(raw, accountId);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: META_CAMPAIGN_LIST_TOOL,
        description:
          "Lists campaigns for an ad account with cursor pagination. Returns configured and effective statuses separately.",
        inputSchema: campaignListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = campaignListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const accountId = resolveAccountId(
            parsed.data.accountId,
            allowedAccountIds,
          );
          try {
            const limit = Math.min(parsed.data.limit, configuredMaxRows);
            const fetched = await fetchGraphListBounded({
              client: options.client,
              path: `${accountIdToApiPath(accountId)}/campaigns`,
              fields: CAMPAIGN_FIELDS,
              limit,
              ...(parsed.data.cursor !== undefined
                ? { after: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            return mapCampaignListResponse(fetched.rows, {
              accountId,
              nextCursor: fetched.nextCursor,
              pagesFetched: fetched.pagesFetched,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: META_AD_SET_LIST_TOOL,
        description:
          "Lists ad sets for an ad account with optional campaign filter. Targeting is summarized without custom audience details.",
        inputSchema: adSetListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = adSetListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const accountId = resolveAccountId(
            parsed.data.accountId,
            allowedAccountIds,
          );
          const filtering =
            parsed.data.campaignId !== undefined
              ? [
                  {
                    field: "campaign.id",
                    operator: "EQUAL",
                    value: parsed.data.campaignId,
                  },
                ]
              : undefined;
          try {
            const limit = Math.min(parsed.data.limit, configuredMaxRows);
            const fetched = await fetchGraphListBounded({
              client: options.client,
              path: `${accountIdToApiPath(accountId)}/adsets`,
              fields: AD_SET_FIELDS,
              limit,
              ...(parsed.data.cursor !== undefined
                ? { after: parsed.data.cursor }
                : {}),
              ...(filtering !== undefined ? { filtering } : {}),
              signal: context.signal,
            });
            return mapAdSetListResponse(fetched.rows, {
              accountId,
              ...(parsed.data.campaignId !== undefined
                ? { campaignId: parsed.data.campaignId }
                : {}),
              nextCursor: fetched.nextCursor,
              pagesFetched: fetched.pagesFetched,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: META_AD_LIST_TOOL,
        description:
          "Lists ads for an ad account with parent campaign and ad set IDs and bounded creative references.",
        inputSchema: adListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = adListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const accountId = resolveAccountId(
            parsed.data.accountId,
            allowedAccountIds,
          );
          try {
            const limit = Math.min(parsed.data.limit, configuredMaxRows);
            const fetched = await fetchGraphListBounded({
              client: options.client,
              path: `${accountIdToApiPath(accountId)}/ads`,
              fields: AD_FIELDS,
              limit,
              ...(parsed.data.cursor !== undefined
                ? { after: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            return mapAdListResponse(fetched.rows, {
              accountId,
              nextCursor: fetched.nextCursor,
              pagesFetched: fetched.pagesFetched,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: META_INSIGHTS_ACCOUNT_TOOL,
        description:
          "Account-level Insights for a bounded date range. Spend is returned as Meta decimal strings in account currency; actions arrays preserve action_type values.",
        inputSchema: insightsAccountInputJsonSchema,
        handler: async (input, context) => {
          const parsed = insightsAccountInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          return runInsightsTool({
            parsed: parsed.data,
            level: "account",
            options,
            allowedAccountIds,
            configuredMaxRows,
            redactionToken,
            signal: context.signal,
          });
        },
      }),
      defineTool({
        name: META_INSIGHTS_CAMPAIGN_TOOL,
        description:
          "Campaign-level Insights for a bounded date range with the same metric preservation rules as account insights.",
        inputSchema: insightsCampaignInputJsonSchema,
        handler: async (input, context) => {
          const parsed = insightsCampaignInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          return runInsightsTool({
            parsed: parsed.data,
            level: "campaign",
            options,
            allowedAccountIds,
            configuredMaxRows,
            redactionToken,
            signal: context.signal,
          });
        },
      }),
      defineTool({
        name: META_INSIGHTS_AD_SET_TOOL,
        description: "Ad-set-level Insights for a bounded date range.",
        inputSchema: insightsAdSetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = insightsAdSetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          return runInsightsTool({
            parsed: parsed.data,
            level: "adset",
            options,
            allowedAccountIds,
            configuredMaxRows,
            redactionToken,
            signal: context.signal,
          });
        },
      }),
      defineTool({
        name: META_INSIGHTS_AD_TOOL,
        description: "Ad-level Insights for a bounded date range.",
        inputSchema: insightsAdInputJsonSchema,
        handler: async (input, context) => {
          const parsed = insightsAdInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          return runInsightsTool({
            parsed: parsed.data,
            level: "ad",
            options,
            allowedAccountIds,
            configuredMaxRows,
            redactionToken,
            signal: context.signal,
          });
        },
      }),
      defineTool({
        name: META_INSIGHTS_BREAKDOWN_TOOL,
        description:
          "Insights with validated breakdown dimensions (age, gender, publisher_platform, platform_position, impression_device). Rejects incompatible combinations.",
        inputSchema: insightsBreakdownInputJsonSchema,
        handler: async (input, context) => {
          const parsed = insightsBreakdownInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          return runInsightsTool({
            parsed: parsed.data,
            level: parsed.data.level,
            breakdowns: parsed.data.breakdowns,
            options,
            allowedAccountIds,
            configuredMaxRows,
            redactionToken,
            signal: context.signal,
          });
        },
      }),
    ],
  });
}

async function runInsightsTool(params: {
  parsed: {
    accountId: string;
    startDate: string;
    endDate: string;
    limit: number;
    cursor?: string;
    actionAttributionWindows?: string[];
    useUnifiedAttributionSetting?: boolean;
  };
  level: "account" | "campaign" | "adset" | "ad";
  breakdowns?: readonly string[];
  options: CreateMetaAdsConnectorOptions;
  allowedAccountIds: readonly string[] | undefined;
  configuredMaxRows: number;
  redactionToken: string | undefined;
  signal?: AbortSignal;
}) {
  const accountId = resolveAccountId(
    params.parsed.accountId,
    params.allowedAccountIds,
  );
  const attributionWindows = validateAttributionWindows(
    params.parsed.actionAttributionWindows,
  );
  try {
    const limit = Math.min(params.parsed.limit, params.configuredMaxRows);
    const fetched = await fetchInsightsBounded({
      client: params.options.client,
      accountPath: accountIdToApiPath(accountId),
      level: params.level,
      timeRange: {
        since: params.parsed.startDate,
        until: params.parsed.endDate,
      },
      limit,
      ...(params.parsed.cursor !== undefined
        ? { after: params.parsed.cursor }
        : {}),
      ...(params.breakdowns !== undefined
        ? { breakdowns: params.breakdowns as never }
        : {}),
      ...(attributionWindows !== undefined
        ? { actionAttributionWindows: attributionWindows }
        : {}),
      ...(params.parsed.useUnifiedAttributionSetting !== undefined
        ? {
            useUnifiedAttributionSetting:
              params.parsed.useUnifiedAttributionSetting,
          }
        : {}),
      signal: params.signal,
    });
    return mapInsightsListResponse(fetched.rows, {
      accountId,
      level: params.breakdowns !== undefined ? "breakdown" : params.level,
      dateRange: {
        since: params.parsed.startDate,
        until: params.parsed.endDate,
      },
      nextCursor: fetched.nextCursor,
      pagesFetched: fetched.pagesFetched,
      attributionNote: DEFAULT_ATTRIBUTION_NOTE,
      ...(attributionWindows !== undefined
        ? { actionAttributionWindows: attributionWindows }
        : {}),
      ...(params.parsed.useUnifiedAttributionSetting !== undefined
        ? {
            useUnifiedAttributionSetting:
              params.parsed.useUnifiedAttributionSetting,
          }
        : {}),
      ...(params.breakdowns !== undefined
        ? { breakdowns: params.breakdowns }
        : {}),
    });
  } catch (error) {
    throw mapError(error, params.redactionToken);
  }
}
