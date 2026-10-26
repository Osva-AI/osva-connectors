import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  ADS_AD_GROUP_PERFORMANCE_TOOL,
  ADS_ASSET_PERFORMANCE_TOOL,
  ADS_CAMPAIGN_LIST_TOOL,
  ADS_CAMPAIGN_PERFORMANCE_TOOL,
  ADS_CUSTOMER_GET_TOOL,
  ADS_CUSTOMER_LIST_TOOL,
  ADS_KEYWORD_PERFORMANCE_TOOL,
  ADS_REPORT_QUERY_TOOL,
  ADS_SEARCH_TERM_PERFORMANCE_TOOL,
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
} from "./constants.js";
import type { GoogleAdsClient } from "./google-ads-client.js";
import {
  buildAdGroupPerformanceQuery,
  buildAssetPerformanceQuery,
  buildCampaignListQuery,
  buildCampaignPerformanceQuery,
  buildCustomerMetadataQuery,
  buildKeywordPerformanceQuery,
  buildSearchTermPerformanceQuery,
} from "./gaql-queries.js";
import { validateGaqlSelectQuery } from "./gaql-validator.js";
import { mapGoogleAdsError } from "./map-google-ads-error.js";
import {
  mapAccessibleCustomersResponse,
  mapCustomerGetResponse,
} from "./normalize-customer.js";
import {
  mapAdGroupPerformanceRow,
  mapAssetPerformanceRow,
  mapCampaignListRow,
  mapCampaignPerformanceRow,
  mapGenericGaqlRow,
  mapKeywordPerformanceRow,
  mapSearchRowsResponse,
  mapSearchTermPerformanceRow,
} from "./normalize-rows.js";
import { resolveCustomerId } from "./resolve-customer.js";
import {
  adGroupPerformanceInputJsonSchema,
  adGroupPerformanceInputSchema,
  assetPerformanceInputJsonSchema,
  assetPerformanceInputSchema,
  buildReportQueryFromStructuredInput,
  campaignListInputJsonSchema,
  campaignListInputSchema,
  campaignPerformanceInputJsonSchema,
  campaignPerformanceInputSchema,
  customerGetInputJsonSchema,
  customerGetInputSchema,
  customerListInputJsonSchema,
  customerListInputSchema,
  keywordPerformanceInputJsonSchema,
  keywordPerformanceInputSchema,
  reportQueryInputJsonSchema,
  reportQueryInputSchema,
  searchTermPerformanceInputJsonSchema,
  searchTermPerformanceInputSchema,
} from "./tool-schemas.js";

export interface CreateGoogleAdsConnectorOptions {
  readonly client: GoogleAdsClient;
  readonly allowedCustomerIds?: readonly string[];
  readonly maxRows?: number;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
): ConnectorSdkError {
  return mapGoogleAdsError(error, { accessToken: accessTokenForRedaction });
}

export function createGoogleAdsConnector(
  options: CreateGoogleAdsConnectorOptions,
): DefinedConnector {
  const allowedCustomerIds = options.allowedCustomerIds;
  const configuredMaxRows = options.maxRows ?? 100;
  const redactionToken = options.accessTokenForRedaction;

  async function runSearch(
    params: {
      customerId: string;
      query: string;
      pageSize?: number;
      pageToken?: string;
      startDate?: string;
      endDate?: string;
      limit: number;
      currencyCode?: string | null;
    },
    mapRow: (
      row: Record<string, unknown>,
      ctx: { currencyCode: string | null },
    ) => Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    const validated = validateGaqlSelectQuery(params.query, configuredMaxRows);
    const raw = await options.client.search({
      customerId: params.customerId,
      query: validated.query,
      pageSize: params.pageSize,
      pageToken: params.pageToken,
      signal,
    });
    return mapSearchRowsResponse(
      raw,
      {
        customerId: params.customerId,
        startDate: params.startDate ?? validated.startDate,
        endDate: params.endDate ?? validated.endDate,
        currencyCode: params.currencyCode ?? null,
        limit: params.limit,
      },
      mapRow,
    );
  }

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Google Ads read-only connector for OSVA Connector Profile V1 (customer discovery, campaign reporting, keyword/search term/asset performance, and constrained GAQL). Requires Google OAuth or service account credentials with adwords scope; account access is enforced by Google Ads permissions.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: ADS_CUSTOMER_LIST_TOOL,
        description:
          "Lists Google Ads customer IDs accessible to the configured credentials via listAccessibleCustomers. Does not guarantee each ID is directly reportable without manager login-customer-id.",
        inputSchema: customerListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = customerListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listAccessibleCustomers({
              signal: context.signal,
            });
            return mapAccessibleCustomersResponse(
              raw,
              allowedCustomerIds,
              parsed.data.limit,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: ADS_CUSTOMER_GET_TOOL,
        description:
          "Returns Google Ads customer metadata (name, currency, timezone, manager flag, status).",
        inputSchema: customerGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = customerGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let customerId: string;
          try {
            customerId = resolveCustomerId(
              parsed.data.customerId,
              allowedCustomerIds,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.search({
              customerId,
              query: buildCustomerMetadataQuery(1),
              signal: context.signal,
            });
            return mapCustomerGetResponse(raw, customerId);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: ADS_CAMPAIGN_LIST_TOOL,
        description:
          "Lists campaigns with status and channel type; optional date-bounded metric summary when startDate and endDate are provided.",
        inputSchema: campaignListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = campaignListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let customerId: string;
          try {
            customerId = resolveCustomerId(
              parsed.data.customerId,
              allowedCustomerIds,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const query = buildCampaignListQuery(
            parsed.data.startDate,
            parsed.data.endDate,
            Math.min(parsed.data.limit, configuredMaxRows),
          );
          try {
            return await runSearch(
              {
                customerId,
                query,
                pageSize: parsed.data.pageSize,
                pageToken: parsed.data.pageToken,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                limit: parsed.data.limit,
              },
              mapCampaignListRow,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: ADS_CAMPAIGN_PERFORMANCE_TOOL,
        description:
          "Returns date-bounded campaign performance metrics including impressions, clicks, cost_micros, conversions, conversion value, and CTR when available.",
        inputSchema: campaignPerformanceInputJsonSchema,
        handler: async (input, context) => {
          const parsed = campaignPerformanceInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let customerId: string;
          try {
            customerId = resolveCustomerId(
              parsed.data.customerId,
              allowedCustomerIds,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const query = buildCampaignPerformanceQuery(
            parsed.data.startDate,
            parsed.data.endDate,
            Math.min(parsed.data.limit, configuredMaxRows),
          );
          try {
            return await runSearch(
              {
                customerId,
                query,
                pageSize: parsed.data.pageSize,
                pageToken: parsed.data.pageToken,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                limit: parsed.data.limit,
                currencyCode: parsed.data.currencyCode ?? null,
              },
              mapCampaignPerformanceRow,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: ADS_AD_GROUP_PERFORMANCE_TOOL,
        description:
          "Returns date-bounded ad group performance, optionally filtered by campaignId.",
        inputSchema: adGroupPerformanceInputJsonSchema,
        handler: async (input, context) => {
          const parsed = adGroupPerformanceInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let customerId: string;
          try {
            customerId = resolveCustomerId(
              parsed.data.customerId,
              allowedCustomerIds,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const query = buildAdGroupPerformanceQuery(
            parsed.data.startDate,
            parsed.data.endDate,
            parsed.data.campaignId,
            Math.min(parsed.data.limit, configuredMaxRows),
          );
          try {
            return await runSearch(
              {
                customerId,
                query,
                pageSize: parsed.data.pageSize,
                pageToken: parsed.data.pageToken,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                limit: parsed.data.limit,
                currencyCode: parsed.data.currencyCode ?? null,
              },
              mapAdGroupPerformanceRow,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: ADS_KEYWORD_PERFORMANCE_TOOL,
        description:
          "Returns keyword-level performance from keyword_view with compatible metrics.",
        inputSchema: keywordPerformanceInputJsonSchema,
        handler: async (input, context) => {
          const parsed = keywordPerformanceInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let customerId: string;
          try {
            customerId = resolveCustomerId(
              parsed.data.customerId,
              allowedCustomerIds,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const query = buildKeywordPerformanceQuery(
            parsed.data.startDate,
            parsed.data.endDate,
            parsed.data.campaignId,
            Math.min(parsed.data.limit, configuredMaxRows),
          );
          try {
            return await runSearch(
              {
                customerId,
                query,
                pageSize: parsed.data.pageSize,
                pageToken: parsed.data.pageToken,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                limit: parsed.data.limit,
                currencyCode: parsed.data.currencyCode ?? null,
              },
              mapKeywordPerformanceRow,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: ADS_SEARCH_TERM_PERFORMANCE_TOOL,
        description:
          "Returns search term performance subject to Google Ads search term visibility and privacy thresholds.",
        inputSchema: searchTermPerformanceInputJsonSchema,
        handler: async (input, context) => {
          const parsed = searchTermPerformanceInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let customerId: string;
          try {
            customerId = resolveCustomerId(
              parsed.data.customerId,
              allowedCustomerIds,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const query = buildSearchTermPerformanceQuery(
            parsed.data.startDate,
            parsed.data.endDate,
            parsed.data.campaignId,
            Math.min(parsed.data.limit, configuredMaxRows),
          );
          try {
            return await runSearch(
              {
                customerId,
                query,
                pageSize: parsed.data.pageSize,
                pageToken: parsed.data.pageToken,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                limit: parsed.data.limit,
                currencyCode: parsed.data.currencyCode ?? null,
              },
              mapSearchTermPerformanceRow,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: ADS_ASSET_PERFORMANCE_TOOL,
        description:
          "Returns asset-level metrics from ad_group_ad_asset_view for supported asset types.",
        inputSchema: assetPerformanceInputJsonSchema,
        handler: async (input, context) => {
          const parsed = assetPerformanceInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let customerId: string;
          try {
            customerId = resolveCustomerId(
              parsed.data.customerId,
              allowedCustomerIds,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const query = buildAssetPerformanceQuery(
            parsed.data.startDate,
            parsed.data.endDate,
            Math.min(parsed.data.limit, configuredMaxRows),
          );
          try {
            return await runSearch(
              {
                customerId,
                query,
                pageSize: parsed.data.pageSize,
                pageToken: parsed.data.pageToken,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                limit: parsed.data.limit,
                currencyCode: parsed.data.currencyCode ?? null,
              },
              mapAssetPerformanceRow,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: ADS_REPORT_QUERY_TOOL,
        description:
          "Runs a constrained GAQL SELECT query built from allowlisted resources, attributes, segments, and metrics with required bounded date ranges.",
        inputSchema: reportQueryInputJsonSchema,
        handler: async (input, context) => {
          const parsed = reportQueryInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let customerId: string;
          try {
            customerId = resolveCustomerId(
              parsed.data.customerId,
              allowedCustomerIds,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const query = buildReportQueryFromStructuredInput({
            resource: parsed.data.resource,
            attributes: parsed.data.attributes,
            metrics: parsed.data.metrics,
            segments: parsed.data.segments,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
            limit: Math.min(
              parsed.data.limit ?? configuredMaxRows,
              configuredMaxRows,
            ),
          });
          try {
            return await runSearch(
              {
                customerId,
                query,
                pageSize: parsed.data.pageSize,
                pageToken: parsed.data.pageToken,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
                limit: Math.min(
                  parsed.data.limit ?? configuredMaxRows,
                  configuredMaxRows,
                ),
                currencyCode: parsed.data.currencyCode ?? null,
              },
              mapGenericGaqlRow,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
