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
  GA4_METADATA_GET_TOOL,
  GA4_PROPERTY_GET_TOOL,
  GA4_PROPERTY_LIST_TOOL,
  GA4_REPORT_ACQUISITION_TOOL,
  GA4_REPORT_ECOMMERCE_TOOL,
  GA4_REPORT_REALTIME_TOOL,
  GA4_REPORT_RUN_TOOL,
} from "./constants.js";
import type { Ga4Client } from "./ga4-client.js";
import { mapGa4Error } from "./map-ga4-error.js";
import { mapMetadataResponse } from "./normalize-metadata.js";
import {
  mapPropertyGetResponse,
  mapPropertyListResponse,
} from "./normalize-property.js";
import { mapRunReportResponse } from "./normalize-report.js";
import { parsePropertyId } from "./property-id.js";
import { resolvePropertyId } from "./resolve-property.js";
import {
  buildDimensionFilterExpression,
  buildMetricFilterExpression,
  buildOrderBys,
  metadataGetInputJsonSchema,
  metadataGetInputSchema,
  propertyGetInputJsonSchema,
  propertyGetInputSchema,
  propertyListInputJsonSchema,
  propertyListInputSchema,
  reportAcquisitionInputJsonSchema,
  reportAcquisitionInputSchema,
  reportEcommerceInputJsonSchema,
  reportEcommerceInputSchema,
  reportRealtimeInputJsonSchema,
  reportRealtimeInputSchema,
  reportRunInputJsonSchema,
  reportRunInputSchema,
} from "./tool-schemas.js";

export interface CreateGa4ConnectorOptions {
  readonly client: Ga4Client;
  readonly defaultPropertyId?: string;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
): ConnectorSdkError {
  return mapGa4Error(error, { accessToken: accessTokenForRedaction });
}

function resolveConfiguredPropertyId(
  input: string | undefined,
  defaultPropertyId: string | undefined,
): string {
  try {
    return resolvePropertyId(input, defaultPropertyId);
  } catch (error) {
    if (error instanceof ConnectorSdkError) {
      throw error;
    }
    throw invalidInputError();
  }
}

export function createGa4Connector(
  options: CreateGa4ConnectorOptions,
): DefinedConnector {
  const defaultPropertyId = options.defaultPropertyId;
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Google Analytics 4 read-only connector for OSVA Connector Profile V1 (property discovery, metadata, core reports, realtime, acquisition, and ecommerce). Requires Google Application Default Credentials or a service account with analytics.readonly scope and GA4 property access granted separately in Analytics Admin.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: GA4_PROPERTY_LIST_TOOL,
        description:
          "Lists GA4 properties accessible to the configured Google credentials via Admin API account summaries. Does not enumerate every property globally.",
        inputSchema: propertyListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = propertyListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listAccountSummaries({
              pageSize: parsed.data.limit,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              signal: context.signal,
            });
            return mapPropertyListResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GA4_PROPERTY_GET_TOOL,
        description:
          "Returns GA4 property metadata (display name, timezone, currency) from the Admin API.",
        inputSchema: propertyGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = propertyGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let propertyId: string;
          try {
            propertyId = resolveConfiguredPropertyId(
              parsed.data.propertyId,
              defaultPropertyId,
            );
            propertyId = parsePropertyId(propertyId);
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getProperty({
              propertyId,
              signal: context.signal,
            });
            return mapPropertyGetResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GA4_METADATA_GET_TOOL,
        description:
          "Returns available report dimensions and metrics from the Data API getMetadata call. Search and pagination are applied locally after a single provider fetch (not Google server-side pagination).",
        inputSchema: metadataGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = metadataGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let propertyId: string;
          try {
            propertyId = parsePropertyId(
              resolveConfiguredPropertyId(
                parsed.data.propertyId,
                defaultPropertyId,
              ),
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getMetadata({
              propertyId,
              signal: context.signal,
            });
            return mapMetadataResponse({
              raw,
              type: parsed.data.type,
              ...(parsed.data.search !== undefined
                ? { search: parsed.data.search }
                : {}),
              limit: parsed.data.limit,
              offset: parsed.data.offset,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GA4_REPORT_RUN_TOOL,
        description:
          "Runs a bounded custom GA4 core report (runReport). Requires at least one metric. Supports offset/limit pagination up to 1000 rows per call.",
        inputSchema: reportRunInputJsonSchema,
        handler: async (input, context) => {
          const parsed = reportRunInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let propertyId: string;
          try {
            propertyId = parsePropertyId(
              resolveConfiguredPropertyId(
                parsed.data.propertyId,
                defaultPropertyId,
              ),
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.runReport({
              propertyId,
              dateRanges: [
                {
                  startDate: parsed.data.startDate,
                  endDate: parsed.data.endDate,
                },
              ],
              dimensions: parsed.data.dimensions.map((name) => ({ name })),
              metrics: parsed.data.metrics.map((name) => ({ name })),
              limit: parsed.data.limit,
              offset: parsed.data.offset,
              ...(parsed.data.dimensionFilter !== undefined
                ? {
                    dimensionFilter: buildDimensionFilterExpression(
                      parsed.data.dimensionFilter,
                    ),
                  }
                : {}),
              ...(parsed.data.metricFilter !== undefined
                ? {
                    metricFilter: buildMetricFilterExpression(
                      parsed.data.metricFilter,
                    ),
                  }
                : {}),
              ...(parsed.data.orderBys !== undefined
                ? { orderBys: buildOrderBys(parsed.data.orderBys) }
                : {}),
              signal: context.signal,
            });
            return mapRunReportResponse({
              propertyId,
              raw,
              limit: parsed.data.limit,
              offset: parsed.data.offset,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GA4_REPORT_REALTIME_TOOL,
        description:
          "Runs a GA4 realtime report (runRealtimeReport). Defaults to activeUsers when metrics are omitted. Realtime dimensions and metrics are a subset of core reporting fields.",
        inputSchema: reportRealtimeInputJsonSchema,
        handler: async (input, context) => {
          const parsed = reportRealtimeInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let propertyId: string;
          try {
            propertyId = parsePropertyId(
              resolveConfiguredPropertyId(
                parsed.data.propertyId,
                defaultPropertyId,
              ),
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const metrics =
            parsed.data.metrics !== undefined && parsed.data.metrics.length > 0
              ? parsed.data.metrics.map((name) => ({ name }))
              : [{ name: "activeUsers" }];
          try {
            const raw = await options.client.runRealtimeReport({
              propertyId,
              ...(parsed.data.dimensions !== undefined
                ? {
                    dimensions: parsed.data.dimensions.map((name) => ({
                      name,
                    })),
                  }
                : {}),
              metrics,
              limit: parsed.data.limit,
              signal: context.signal,
            });
            return mapRunReportResponse({
              propertyId,
              raw,
              limit: parsed.data.limit,
              offset: 0,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GA4_REPORT_ACQUISITION_TOOL,
        description:
          "Runs a session acquisition performance report using sessionDefaultChannelGroup and sessionSourceMedium dimensions with sessions, activeUsers, engagedSessions, and keyEvents metrics.",
        inputSchema: reportAcquisitionInputJsonSchema,
        handler: async (input, context) => {
          const parsed = reportAcquisitionInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let propertyId: string;
          try {
            propertyId = parsePropertyId(
              resolveConfiguredPropertyId(
                parsed.data.propertyId,
                defaultPropertyId,
              ),
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const dimensionFilter =
            parsed.data.channelGrouping !== undefined
              ? buildDimensionFilterExpression({
                  fieldName: "sessionDefaultChannelGroup",
                  inListFilter: {
                    values: [parsed.data.channelGrouping],
                  },
                })
              : undefined;
          try {
            const raw = await options.client.runReport({
              propertyId,
              dateRanges: [
                {
                  startDate: parsed.data.startDate,
                  endDate: parsed.data.endDate,
                },
              ],
              dimensions: [
                { name: "sessionDefaultChannelGroup" },
                { name: "sessionSourceMedium" },
              ],
              metrics: [
                { name: "sessions" },
                { name: "activeUsers" },
                { name: "engagedSessions" },
                { name: "keyEvents" },
              ],
              limit: parsed.data.limit,
              offset: parsed.data.offset,
              ...(dimensionFilter !== undefined ? { dimensionFilter } : {}),
              signal: context.signal,
            });
            return mapRunReportResponse({
              propertyId,
              raw,
              limit: parsed.data.limit,
              offset: parsed.data.offset,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GA4_REPORT_ECOMMERCE_TOOL,
        description:
          "Runs a bounded ecommerce report. Overview uses property-level purchase metrics; product breakdown uses item-scoped dimensions and metrics in a separate query shape.",
        inputSchema: reportEcommerceInputJsonSchema,
        handler: async (input, context) => {
          const parsed = reportEcommerceInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let propertyId: string;
          try {
            propertyId = parsePropertyId(
              resolveConfiguredPropertyId(
                parsed.data.propertyId,
                defaultPropertyId,
              ),
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            if (parsed.data.breakdown === "product") {
              const raw = await options.client.runReport({
                propertyId,
                dateRanges: [
                  {
                    startDate: parsed.data.startDate,
                    endDate: parsed.data.endDate,
                  },
                ],
                dimensions: [{ name: "itemName" }, { name: "itemId" }],
                metrics: [
                  { name: "itemsPurchased" },
                  { name: "purchaseRevenue" },
                ],
                limit: parsed.data.limit,
                offset: parsed.data.offset,
                signal: context.signal,
              });
              return mapRunReportResponse({
                propertyId,
                raw,
                limit: parsed.data.limit,
                offset: parsed.data.offset,
              });
            }

            const raw = await options.client.runReport({
              propertyId,
              dateRanges: [
                {
                  startDate: parsed.data.startDate,
                  endDate: parsed.data.endDate,
                },
              ],
              metrics: [
                { name: "ecommercePurchases" },
                { name: "purchaseRevenue" },
                { name: "totalRevenue" },
              ],
              limit: parsed.data.limit,
              offset: parsed.data.offset,
              signal: context.signal,
            });
            return mapRunReportResponse({
              propertyId,
              raw,
              limit: parsed.data.limit,
              offset: parsed.data.offset,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
