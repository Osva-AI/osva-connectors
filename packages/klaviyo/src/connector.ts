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
  EVENTS_MAX_PAGE_SIZE,
  KLAVIYO_ACCOUNT_GET_TOOL,
  KLAVIYO_CAMPAIGN_GET_TOOL,
  KLAVIYO_CAMPAIGN_LIST_TOOL,
  KLAVIYO_EVENT_LIST_TOOL,
  KLAVIYO_FLOW_GET_TOOL,
  KLAVIYO_FLOW_LIST_TOOL,
  KLAVIYO_METRIC_GET_TOOL,
  KLAVIYO_METRIC_LIST_TOOL,
  KLAVIYO_REPORT_CAMPAIGN_TOOL,
  KLAVIYO_REPORT_FLOW_TOOL,
} from "./constants.js";
import type { KlaviyoClient } from "./klaviyo-client.js";
import { fetchKlaviyoListBounded } from "./klaviyo-list-fetch.js";
import { mapKlaviyoError } from "./map-klaviyo-error.js";
import { mapValuesReportResponse } from "./normalize-report.js";
import {
  mapAccountGetResponse,
  mapResourceGetResponse,
  mapResourceListResponse,
} from "./normalize-resources.js";
import {
  buildCampaignValuesReportFilter,
  buildFlowValuesReportFilter,
} from "./report-filter.js";
import {
  buildKlaviyoTimeframeAttribute,
  parseReportTimeframeInput,
  validateCampaignGroupBy,
  validateFlowGroupBy,
  validateReportStatistics,
} from "./reporting-allowlist.js";
import {
  accountGetInputJsonSchema,
  accountGetInputSchema,
  buildEventsDatetimeFilter,
  campaignGetInputJsonSchema,
  campaignGetInputSchema,
  campaignListInputJsonSchema,
  campaignListInputSchema,
  eventListInputJsonSchema,
  eventListInputSchema,
  flowGetInputJsonSchema,
  flowGetInputSchema,
  flowListInputJsonSchema,
  flowListInputSchema,
  metricGetInputJsonSchema,
  metricGetInputSchema,
  metricListInputJsonSchema,
  metricListInputSchema,
  reportCampaignInputJsonSchema,
  reportCampaignInputSchema,
  reportFlowInputJsonSchema,
  reportFlowInputSchema,
} from "./tool-schemas.js";

export interface CreateKlaviyoConnectorOptions {
  readonly client: KlaviyoClient;
  readonly maxRows?: number;
  readonly privateApiKeyForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  privateApiKeyForRedaction?: string,
): ConnectorSdkError {
  return mapKlaviyoError(error, {
    privateApiKey: privateApiKeyForRedaction,
  });
}

export function createKlaviyoConnector(
  options: CreateKlaviyoConnectorOptions,
): DefinedConnector {
  const configuredMaxRows = options.maxRows ?? 100;
  const redactionToken = options.privateApiKeyForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Klaviyo read-only connector for OSVA Connector Profile V1 (account discovery, campaigns, flows, metrics, bounded events, and Reporting API values reports). Requires a Klaviyo private API key with accounts:read, campaigns:read, flows:read, metrics:read, and events:read scopes as applicable.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: KLAVIYO_ACCOUNT_GET_TOOL,
        description:
          "Returns Klaviyo account metadata from GET /accounts (accounts:read).",
        inputSchema: accountGetInputJsonSchema,
        handler: async (_input, context) => {
          const parsed = accountGetInputSchema.safeParse(_input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getAccounts({
              signal: context.signal,
            });
            return mapAccountGetResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_CAMPAIGN_LIST_TOOL,
        description:
          "Lists Klaviyo campaigns with bounded cursor pagination (campaigns:read).",
        inputSchema: campaignListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = campaignListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          try {
            const fetched = await fetchKlaviyoListBounded({
              limit,
              ...(parsed.data.pageCursor !== undefined
                ? { pageCursor: parsed.data.pageCursor }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listCampaigns(pageParams),
            });
            return mapResourceListResponse(
              "campaign",
              { data: fetched.rows },
              {
                ...(fetched.nextCursor !== undefined
                  ? { nextCursor: fetched.nextCursor }
                  : {}),
                ...(fetched.rowsTruncated ? { rowsTruncated: true } : {}),
              },
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_CAMPAIGN_GET_TOOL,
        description:
          "Returns a single Klaviyo campaign by ID (campaigns:read).",
        inputSchema: campaignGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = campaignGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getCampaign({
              id: parsed.data.campaignId,
              signal: context.signal,
            });
            return mapResourceGetResponse("campaign", raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_FLOW_LIST_TOOL,
        description:
          "Lists Klaviyo flows with bounded cursor pagination (flows:read).",
        inputSchema: flowListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = flowListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          try {
            const fetched = await fetchKlaviyoListBounded({
              limit,
              ...(parsed.data.pageCursor !== undefined
                ? { pageCursor: parsed.data.pageCursor }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) => options.client.listFlows(pageParams),
            });
            return mapResourceListResponse(
              "flow",
              { data: fetched.rows },
              {
                ...(fetched.nextCursor !== undefined
                  ? { nextCursor: fetched.nextCursor }
                  : {}),
                ...(fetched.rowsTruncated ? { rowsTruncated: true } : {}),
              },
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_FLOW_GET_TOOL,
        description: "Returns a single Klaviyo flow by ID (flows:read).",
        inputSchema: flowGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = flowGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getFlow({
              id: parsed.data.flowId,
              signal: context.signal,
            });
            return mapResourceGetResponse("flow", raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_METRIC_LIST_TOOL,
        description:
          "Lists Klaviyo metrics with bounded cursor pagination (metrics:read). Use metric IDs for conversion_metric_id in reporting tools.",
        inputSchema: metricListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = metricListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          try {
            const fetched = await fetchKlaviyoListBounded({
              limit,
              ...(parsed.data.pageCursor !== undefined
                ? { pageCursor: parsed.data.pageCursor }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) => options.client.listMetrics(pageParams),
            });
            return mapResourceListResponse(
              "metric",
              { data: fetched.rows },
              {
                ...(fetched.nextCursor !== undefined
                  ? { nextCursor: fetched.nextCursor }
                  : {}),
                ...(fetched.rowsTruncated ? { rowsTruncated: true } : {}),
              },
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_METRIC_GET_TOOL,
        description: "Returns a single Klaviyo metric by ID (metrics:read).",
        inputSchema: metricGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = metricGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getMetric({
              id: parsed.data.metricId,
              signal: context.signal,
            });
            return mapResourceGetResponse("metric", raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_EVENT_LIST_TOOL,
        description:
          "Lists Klaviyo events filtered by datetime range (metrics:read, events:read). Requests sparse event fields only (id, datetime, timestamp, uuid); excludes event_properties and profile data. page[size] max 200.",
        inputSchema: eventListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          const filter = buildEventsDatetimeFilter(
            parsed.data.startDatetime,
            parsed.data.endDatetime,
          );
          try {
            const fetched = await fetchKlaviyoListBounded({
              limit,
              maxPageSize: EVENTS_MAX_PAGE_SIZE,
              ...(parsed.data.pageCursor !== undefined
                ? { pageCursor: parsed.data.pageCursor }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listEvents({
                  ...pageParams,
                  filter,
                }),
            });
            return mapResourceListResponse(
              "event",
              { data: fetched.rows },
              {
                ...(fetched.nextCursor !== undefined
                  ? { nextCursor: fetched.nextCursor }
                  : {}),
                ...(fetched.rowsTruncated ? { rowsTruncated: true } : {}),
              },
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_REPORT_CAMPAIGN_TOOL,
        description:
          "Runs a Klaviyo campaign values report (POST /campaign-values-reports). conversion_metric_id is required. Optional structured filter (sendChannels, campaignId, tags, etc.). Preserves groupings and statistics from Klaviyo.",
        inputSchema: reportCampaignInputJsonSchema,
        handler: async (input, context) => {
          const parsed = reportCampaignInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let timeframe;
          try {
            timeframe = parseReportTimeframeInput({
              ...(parsed.data.timeframeKey !== undefined
                ? { timeframeKey: parsed.data.timeframeKey }
                : {}),
              ...(parsed.data.start !== undefined
                ? { start: parsed.data.start }
                : {}),
              ...(parsed.data.end !== undefined
                ? { end: parsed.data.end }
                : {}),
            });
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const statistics = validateReportStatistics(parsed.data.statistics);
          const groupBy = validateCampaignGroupBy(parsed.data.groupBy);
          let reportFilter: string | undefined;
          try {
            reportFilter = buildCampaignValuesReportFilter(parsed.data.filter);
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.queryCampaignValuesReport({
              statistics,
              timeframe: buildKlaviyoTimeframeAttribute(timeframe),
              conversionMetricId: parsed.data.conversionMetricId,
              ...(groupBy !== undefined ? { groupBy } : {}),
              ...(reportFilter !== undefined ? { filter: reportFilter } : {}),
              ...(parsed.data.pageCursor !== undefined
                ? { pageCursor: parsed.data.pageCursor }
                : {}),
              signal: context.signal,
            });
            return mapValuesReportResponse("campaign", raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: KLAVIYO_REPORT_FLOW_TOOL,
        description:
          "Runs a Klaviyo flow values report (POST /flow-values-reports). conversion_metric_id is required. Optional structured filter (sendChannels, flowId, tags, etc.). Preserves groupings and statistics from Klaviyo.",
        inputSchema: reportFlowInputJsonSchema,
        handler: async (input, context) => {
          const parsed = reportFlowInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let timeframe;
          try {
            timeframe = parseReportTimeframeInput({
              ...(parsed.data.timeframeKey !== undefined
                ? { timeframeKey: parsed.data.timeframeKey }
                : {}),
              ...(parsed.data.start !== undefined
                ? { start: parsed.data.start }
                : {}),
              ...(parsed.data.end !== undefined
                ? { end: parsed.data.end }
                : {}),
            });
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const statistics = validateReportStatistics(parsed.data.statistics);
          const groupBy = validateFlowGroupBy(parsed.data.groupBy);
          let reportFilter: string | undefined;
          try {
            reportFilter = buildFlowValuesReportFilter(parsed.data.filter);
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.queryFlowValuesReport({
              statistics,
              timeframe: buildKlaviyoTimeframeAttribute(timeframe),
              conversionMetricId: parsed.data.conversionMetricId,
              ...(groupBy !== undefined ? { groupBy } : {}),
              ...(reportFilter !== undefined ? { filter: reportFilter } : {}),
              ...(parsed.data.pageCursor !== undefined
                ? { pageCursor: parsed.data.pageCursor }
                : {}),
              signal: context.signal,
            });
            return mapValuesReportResponse("flow", raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
