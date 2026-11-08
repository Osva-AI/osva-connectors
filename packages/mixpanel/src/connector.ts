import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import { assertResourceAllowed, createResourceAllowlist } from "./allowlist.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  MIXPANEL_COHORT_LIST_TOOL,
  MIXPANEL_EVENT_TOP_TOOL,
  MIXPANEL_FUNNEL_GET_TOOL,
  MIXPANEL_REPORT_GET_TOOL,
  MIXPANEL_RETENTION_RUN_TOOL,
  MIXPANEL_SEGMENTATION_RUN_TOOL,
} from "./constants.js";
import { mapMixpanelError } from "./map-mixpanel-error.js";
import type { MixpanelClient } from "./mixpanel-client.js";
import { normalizeMixpanelResponse } from "./normalize-response.js";
import type { MixpanelConfig } from "./schemas.js";
import {
  cohortListInputJsonSchema,
  cohortListInputSchema,
  eventTopInputJsonSchema,
  eventTopInputSchema,
  funnelGetInputJsonSchema,
  funnelGetInputSchema,
  reportGetInputJsonSchema,
  reportGetInputSchema,
  retentionRunInputJsonSchema,
  retentionRunInputSchema,
  segmentationRunInputJsonSchema,
  segmentationRunInputSchema,
} from "./tool-schemas.js";

export interface CreateMixpanelConnectorOptions {
  readonly client: MixpanelClient;
  readonly config: MixpanelConfig;
  readonly credentialsForRedaction?: {
    readonly username: string;
    readonly secret: string;
  };
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  credentials?: CreateMixpanelConnectorOptions["credentialsForRedaction"],
): ConnectorSdkError {
  return mapMixpanelError(error, {
    ...(credentials !== undefined
      ? {
          serviceAccountUsername: credentials.username,
          serviceAccountSecret: credentials.secret,
        }
      : {}),
  });
}

function normalize(
  projectId: number,
  raw: unknown,
): ReturnType<typeof normalizeMixpanelResponse> {
  return normalizeMixpanelResponse({ projectId, raw });
}

export function createMixpanelConnector(
  options: CreateMixpanelConnectorOptions,
): DefinedConnector {
  const { client, config } = options;
  const credentials = options.credentialsForRedaction;
  const bookmarkAllowlist = createResourceAllowlist(config.allowedBookmarkIds);
  const funnelAllowlist = createResourceAllowlist(config.allowedFunnelIds);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Mixpanel read-only Query API connector for OSVA Connector Profile V1 (saved insights, segmentation, funnels, retention, cohort list, and top events). Uses project-scoped service account Basic authentication configured via environment variables.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: MIXPANEL_REPORT_GET_TOOL,
        description:
          "Loads a saved Insights report (GET /insights) by bookmark_id for the configured project.",
        inputSchema: reportGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = reportGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertResourceAllowed(
            bookmarkAllowlist,
            parsed.data.bookmarkId,
            "Bookmark",
          );
          try {
            const raw = await client.getInsights({
              bookmarkId: parsed.data.bookmarkId,
              signal: context.signal,
            });
            return normalize(config.projectId, raw);
          } catch (error) {
            throw mapError(error, credentials);
          }
        },
      }),
      defineTool({
        name: MIXPANEL_SEGMENTATION_RUN_TOOL,
        description:
          "Runs an ad-hoc segmentation query (GET /segmentation) for a single event and bounded date range (max 90 days).",
        inputSchema: segmentationRunInputJsonSchema,
        handler: async (input, context) => {
          const parsed = segmentationRunInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await client.runSegmentation({
              event: parsed.data.event,
              fromDate: parsed.data.fromDate,
              toDate: parsed.data.toDate,
              ...(parsed.data.unit !== undefined
                ? { unit: parsed.data.unit }
                : {}),
              ...(parsed.data.where !== undefined
                ? { where: parsed.data.where }
                : {}),
              ...(parsed.data.on !== undefined ? { on: parsed.data.on } : {}),
              limit: parsed.data.limit,
              signal: context.signal,
            });
            return normalize(config.projectId, raw);
          } catch (error) {
            throw mapError(error, credentials);
          }
        },
      }),
      defineTool({
        name: MIXPANEL_FUNNEL_GET_TOOL,
        description:
          "Loads a saved funnel report (GET /funnels) by funnel_id for the configured project.",
        inputSchema: funnelGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = funnelGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertResourceAllowed(
            funnelAllowlist,
            parsed.data.funnelId,
            "Funnel",
          );
          try {
            const raw = await client.getFunnel({
              funnelId: parsed.data.funnelId,
              fromDate: parsed.data.fromDate,
              toDate: parsed.data.toDate,
              ...(parsed.data.unit !== undefined
                ? { unit: parsed.data.unit }
                : {}),
              ...(parsed.data.where !== undefined
                ? { where: parsed.data.where }
                : {}),
              ...(parsed.data.on !== undefined ? { on: parsed.data.on } : {}),
              signal: context.signal,
            });
            return normalize(config.projectId, raw);
          } catch (error) {
            throw mapError(error, credentials);
          }
        },
      }),
      defineTool({
        name: MIXPANEL_RETENTION_RUN_TOOL,
        description:
          "Runs an ad-hoc retention query (GET /retention) with bounded lookback (max 90 days).",
        inputSchema: retentionRunInputJsonSchema,
        handler: async (input, context) => {
          const parsed = retentionRunInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await client.runRetention({
              bornEvent: parsed.data.bornEvent,
              event: parsed.data.event,
              fromDate: parsed.data.fromDate,
              toDate: parsed.data.toDate,
              retentionType: parsed.data.retentionType,
              ...(parsed.data.unit !== undefined
                ? { unit: parsed.data.unit }
                : {}),
              ...(parsed.data.where !== undefined
                ? { where: parsed.data.where }
                : {}),
              ...(parsed.data.on !== undefined ? { on: parsed.data.on } : {}),
              limit: parsed.data.limit,
              signal: context.signal,
            });
            return normalize(config.projectId, raw);
          } catch (error) {
            throw mapError(error, credentials);
          }
        },
      }),
      defineTool({
        name: MIXPANEL_COHORT_LIST_TOOL,
        description:
          "Lists cohorts for the configured project (POST /cohorts/list).",
        inputSchema: cohortListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = cohortListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await client.listCohorts({
              signal: context.signal,
            });
            let data: unknown = raw;
            if (Array.isArray(raw) && raw.length > parsed.data.limit) {
              data = {
                cohorts: raw.slice(0, parsed.data.limit),
                cohortsTruncatedLocally: true as const,
                providerCohortCount: raw.length,
              };
            }
            return normalize(config.projectId, data);
          } catch (error) {
            throw mapError(error, credentials);
          }
        },
      }),
      defineTool({
        name: MIXPANEL_EVENT_TOP_TOOL,
        description:
          "Returns top events for the project (GET /events/top) with a bounded limit.",
        inputSchema: eventTopInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventTopInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await client.getTopEvents({
              limit: parsed.data.limit,
              type: parsed.data.type,
              signal: context.signal,
            });
            return normalize(config.projectId, raw);
          } catch (error) {
            throw mapError(error, credentials);
          }
        },
      }),
    ],
  });
}
