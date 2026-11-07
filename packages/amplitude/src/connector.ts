import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import type { AmplitudeClient } from "./amplitude-client.js";
import {
  assertChartAllowed,
  createChartAllowlist,
  type ChartAllowlist,
} from "./chart-allowlist.js";
import { assertBoundedDateRange } from "./bound-dates.js";
import {
  AMPLITUDE_CHART_GET_TOOL,
  AMPLITUDE_EVENT_LIST_TOOL,
  AMPLITUDE_EVENT_SEGMENTATION_TOOL,
  AMPLITUDE_FUNNEL_RUN_TOOL,
  AMPLITUDE_RETENTION_RUN_TOOL,
  AMPLITUDE_SESSION_AVERAGE_TOOL,
  AMPLITUDE_USER_ACTIVE_TOOL,
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
} from "./constants.js";
import { mapAmplitudeError } from "./map-amplitude-error.js";
import {
  AMPLITUDE_PROVIDER_CALCULATED_LABELS,
  mapChartQueryResponse,
  mapEventListResponse,
  mapSeriesAnalyticsResponse,
} from "./normalize-amplitude.js";
import {
  chartGetInputJsonSchema,
  chartGetInputSchema,
  eventListInputJsonSchema,
  eventListInputSchema,
  eventSegmentationInputJsonSchema,
  eventSegmentationInputSchema,
  funnelRunInputJsonSchema,
  funnelRunInputSchema,
  retentionRunInputJsonSchema,
  retentionRunInputSchema,
  sessionAverageInputJsonSchema,
  sessionAverageInputSchema,
  userActiveInputJsonSchema,
  userActiveInputSchema,
} from "./tool-schemas.js";

export interface CreateAmplitudeConnectorOptions {
  readonly client: AmplitudeClient;
  readonly allowedChartIds?: readonly string[];
  readonly apiKeyForRedaction?: string;
  readonly secretKeyForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  apiKeyForRedaction?: string,
  secretKeyForRedaction?: string,
): ConnectorSdkError {
  return mapAmplitudeError(error, {
    apiKey: apiKeyForRedaction,
    secretKey: secretKeyForRedaction,
  });
}

function resolveChartAllowlist(
  allowedChartIds: readonly string[] | undefined,
): ChartAllowlist | undefined {
  return createChartAllowlist(
    allowedChartIds !== undefined ? [...allowedChartIds] : undefined,
  );
}

export function createAmplitudeConnector(
  options: CreateAmplitudeConnectorOptions,
): DefinedConnector {
  const chartAllowlist = resolveChartAllowlist(options.allowedChartIds);
  const redactApiKey = options.apiKeyForRedaction;
  const redactSecretKey = options.secretKeyForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Amplitude read-only connector for OSVA Connector Profile V1 (Dashboard REST: event catalog, segmentation, funnels, retention, aggregate active users, saved chart queries, and average session length). Uses HTTP Basic authentication with project API and secret keys. Does not expose per-user activity search endpoints.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: AMPLITUDE_EVENT_LIST_TOOL,
        description:
          "Lists event types in the Amplitude project (GET /api/2/events/list).",
        inputSchema: eventListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listEventTypes({
              signal: context.signal,
            });
            return mapEventListResponse(raw);
          } catch (error) {
            throw mapError(error, redactApiKey, redactSecretKey);
          }
        },
      }),
      defineTool({
        name: AMPLITUDE_EVENT_SEGMENTATION_TOOL,
        description:
          "Queries event segmentation metrics (GET /api/2/events/segmentation). Dates are YYYYMMDD with at most 90-day lookback. Up to two group-by properties.",
        inputSchema: eventSegmentationInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventSegmentationInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const range = assertBoundedDateRange(
            parsed.data.start,
            parsed.data.end,
          );
          try {
            const raw = await options.client.queryEventSegmentation({
              start: range.start,
              end: range.end,
              event: parsed.data.event,
              ...(parsed.data.secondEvent !== undefined
                ? { secondEvent: parsed.data.secondEvent }
                : {}),
              ...(parsed.data.metric !== undefined
                ? { metric: parsed.data.metric }
                : {}),
              ...(parsed.data.interval !== undefined
                ? { interval: parsed.data.interval }
                : {}),
              ...(parsed.data.groupBy !== undefined
                ? { groupBy: parsed.data.groupBy }
                : {}),
              ...(parsed.data.segment !== undefined
                ? { segment: parsed.data.segment }
                : {}),
              ...(parsed.data.limit !== undefined
                ? { limit: parsed.data.limit }
                : {}),
              signal: context.signal,
            });
            return mapSeriesAnalyticsResponse({
              raw,
              start: range.start,
              end: range.end,
              providerCalculated:
                AMPLITUDE_PROVIDER_CALCULATED_LABELS.timeSeries,
            });
          } catch (error) {
            throw mapError(error, redactApiKey, redactSecretKey);
          }
        },
      }),
      defineTool({
        name: AMPLITUDE_FUNNEL_RUN_TOOL,
        description:
          "Runs funnel analysis (GET /api/2/funnels). Supports at most five funnel steps and a 90-day bounded date range.",
        inputSchema: funnelRunInputJsonSchema,
        handler: async (input, context) => {
          const parsed = funnelRunInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const range = assertBoundedDateRange(
            parsed.data.start,
            parsed.data.end,
          );
          try {
            const raw = await options.client.queryFunnel({
              start: range.start,
              end: range.end,
              events: parsed.data.events,
              ...(parsed.data.mode !== undefined
                ? { mode: parsed.data.mode }
                : {}),
              ...(parsed.data.userType !== undefined
                ? { userType: parsed.data.userType }
                : {}),
              ...(parsed.data.interval !== undefined
                ? { interval: parsed.data.interval }
                : {}),
              ...(parsed.data.groupBy !== undefined
                ? { groupBy: parsed.data.groupBy }
                : {}),
              ...(parsed.data.segment !== undefined
                ? { segment: parsed.data.segment }
                : {}),
              signal: context.signal,
            });
            return mapSeriesAnalyticsResponse({
              raw,
              start: range.start,
              end: range.end,
              providerCalculated:
                AMPLITUDE_PROVIDER_CALCULATED_LABELS.funnelSteps,
            });
          } catch (error) {
            throw mapError(error, redactApiKey, redactSecretKey);
          }
        },
      }),
      defineTool({
        name: AMPLITUDE_RETENTION_RUN_TOOL,
        description:
          "Runs retention analysis (GET /api/2/retention) for start and return events within a 90-day bounded window.",
        inputSchema: retentionRunInputJsonSchema,
        handler: async (input, context) => {
          const parsed = retentionRunInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const range = assertBoundedDateRange(
            parsed.data.start,
            parsed.data.end,
          );
          try {
            const raw = await options.client.queryRetention({
              start: range.start,
              end: range.end,
              startEvent: parsed.data.startEvent,
              returnEvent: parsed.data.returnEvent,
              ...(parsed.data.retentionMode !== undefined
                ? { retentionMode: parsed.data.retentionMode }
                : {}),
              ...(parsed.data.interval !== undefined
                ? { interval: parsed.data.interval }
                : {}),
              ...(parsed.data.groupBy !== undefined
                ? { groupBy: parsed.data.groupBy }
                : {}),
              ...(parsed.data.segment !== undefined
                ? { segment: parsed.data.segment }
                : {}),
              signal: context.signal,
            });
            return mapSeriesAnalyticsResponse({
              raw,
              start: range.start,
              end: range.end,
              providerCalculated:
                AMPLITUDE_PROVIDER_CALCULATED_LABELS.retentionCohorts,
            });
          } catch (error) {
            throw mapError(error, redactApiKey, redactSecretKey);
          }
        },
      }),
      defineTool({
        name: AMPLITUDE_USER_ACTIVE_TOOL,
        description:
          "Returns aggregate active or new user time series (GET /api/2/users). Not a per-user activity search.",
        inputSchema: userActiveInputJsonSchema,
        handler: async (input, context) => {
          const parsed = userActiveInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const range = assertBoundedDateRange(
            parsed.data.start,
            parsed.data.end,
          );
          try {
            const raw = await options.client.queryActiveUsers({
              start: range.start,
              end: range.end,
              ...(parsed.data.userMetric !== undefined
                ? { userMetric: parsed.data.userMetric }
                : {}),
              ...(parsed.data.interval !== undefined
                ? { interval: parsed.data.interval }
                : {}),
              ...(parsed.data.groupBy !== undefined
                ? { groupBy: parsed.data.groupBy }
                : {}),
              ...(parsed.data.segment !== undefined
                ? { segment: parsed.data.segment }
                : {}),
              signal: context.signal,
            });
            return mapSeriesAnalyticsResponse({
              raw,
              start: range.start,
              end: range.end,
              providerCalculated:
                AMPLITUDE_PROVIDER_CALCULATED_LABELS.activeUsers,
            });
          } catch (error) {
            throw mapError(error, redactApiKey, redactSecretKey);
          }
        },
      }),
      defineTool({
        name: AMPLITUDE_CHART_GET_TOOL,
        description:
          "Queries a saved Amplitude chart (GET /api/3/chart/{id}/query). Honours OSVA_CONNECTOR_AMPLITUDE_ALLOWED_CHART_IDS when set.",
        inputSchema: chartGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = chartGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertChartAllowed(chartAllowlist, parsed.data.chartId);
            const raw = await options.client.queryChart({
              chartId: parsed.data.chartId,
              signal: context.signal,
            });
            return mapChartQueryResponse({
              raw,
              chartId: parsed.data.chartId,
            });
          } catch (error) {
            throw mapError(error, redactApiKey, redactSecretKey);
          }
        },
      }),
      defineTool({
        name: AMPLITUDE_SESSION_AVERAGE_TOOL,
        description:
          "Returns average session length per day (GET /api/2/sessions/average) for a bounded YYYYMMDD date range.",
        inputSchema: sessionAverageInputJsonSchema,
        handler: async (input, context) => {
          const parsed = sessionAverageInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const range = assertBoundedDateRange(
            parsed.data.start,
            parsed.data.end,
          );
          try {
            const raw = await options.client.queryAverageSessionLength({
              start: range.start,
              end: range.end,
              signal: context.signal,
            });
            return mapSeriesAnalyticsResponse({
              raw,
              start: range.start,
              end: range.end,
              providerCalculated:
                AMPLITUDE_PROVIDER_CALCULATED_LABELS.averageSessionLength,
            });
          } catch (error) {
            throw mapError(error, redactApiKey, redactSecretKey);
          }
        },
      }),
    ],
  });
}
