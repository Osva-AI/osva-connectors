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
  GSC_PERFORMANCE_PAGES_TOOL,
  GSC_PERFORMANCE_QUERIES_TOOL,
  GSC_PERFORMANCE_QUERY_TOOL,
  GSC_PROPERTY_GET_TOOL,
  GSC_PROPERTY_LIST_TOOL,
  GSC_SITEMAP_GET_TOOL,
  GSC_SITEMAP_LIST_TOOL,
  GSC_URL_INSPECT_TOOL,
} from "./constants.js";
import type { GscClient } from "./gsc-client.js";
import { mapGscError } from "./map-gsc-error.js";
import {
  mapPerformancePagesResponse,
  mapPerformanceQueriesResponse,
  mapSearchAnalyticsResponse,
} from "./normalize-analytics.js";
import {
  mapPropertyGetResponse,
  mapPropertyListResponse,
} from "./normalize-property.js";
import {
  mapSitemapGetResponse,
  mapSitemapListResponse,
} from "./normalize-sitemap.js";
import { mapUrlInspectionResponse } from "./normalize-url-inspection.js";
import { resolveSiteUrl } from "./resolve-site-url.js";
import { parseSiteUrl } from "./site-url.js";
import {
  buildDimensionFilterGroupsFromInput,
  buildPresetDimensionFilterGroups,
  performancePagesInputJsonSchema,
  performancePagesInputSchema,
  performanceQueriesInputJsonSchema,
  performanceQueriesInputSchema,
  performanceQueryInputJsonSchema,
  performanceQueryInputSchema,
  propertyGetInputJsonSchema,
  propertyGetInputSchema,
  propertyListInputJsonSchema,
  propertyListInputSchema,
  sitemapGetInputJsonSchema,
  sitemapGetInputSchema,
  sitemapListInputJsonSchema,
  sitemapListInputSchema,
  urlInspectInputJsonSchema,
  urlInspectInputSchema,
} from "./tool-schemas.js";

export interface CreateGscConnectorOptions {
  readonly client: GscClient;
  readonly defaultSiteUrl?: string;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
): ConnectorSdkError {
  return mapGscError(error, { accessToken: accessTokenForRedaction });
}

function resolveConfiguredSiteUrl(
  input: string | undefined,
  defaultSiteUrl: string | undefined,
): string {
  try {
    return parseSiteUrl(resolveSiteUrl(input, defaultSiteUrl));
  } catch (error) {
    if (error instanceof ConnectorSdkError) {
      throw error;
    }
    throw invalidInputError();
  }
}

export function createGscConnector(
  options: CreateGscConnectorOptions,
): DefinedConnector {
  const defaultSiteUrl = options.defaultSiteUrl;
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Google Search Console read-only connector for OSVA Connector Profile V1 (property discovery, search analytics, sitemaps, and URL inspection). Requires Google Application Default Credentials or a service account with Search Console property access granted separately in Search Console settings.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: GSC_PROPERTY_LIST_TOOL,
        description:
          "Lists Search Console properties accessible to the configured Google credentials via sites.list.",
        inputSchema: propertyListInputJsonSchema,
        handler: async (_input, context) => {
          const parsed = propertyListInputSchema.safeParse(_input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listSites({
              signal: context.signal,
            });
            return mapPropertyListResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GSC_PROPERTY_GET_TOOL,
        description:
          "Returns Search Console property metadata (siteUrl and permissionLevel) from sites.get.",
        inputSchema: propertyGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = propertyGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let siteUrl: string;
          try {
            siteUrl = resolveConfiguredSiteUrl(
              parsed.data.siteUrl,
              defaultSiteUrl,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getSite({
              siteUrl,
              signal: context.signal,
            });
            return mapPropertyGetResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GSC_PERFORMANCE_QUERY_TOOL,
        description:
          "Runs a bounded Search Analytics query (searchanalytics.query). Returns top rows only; pagination uses startRow/rowLimit without exhaustive export.",
        inputSchema: performanceQueryInputJsonSchema,
        handler: async (input, context) => {
          const parsed = performanceQueryInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let siteUrl: string;
          try {
            siteUrl = resolveConfiguredSiteUrl(
              parsed.data.siteUrl,
              defaultSiteUrl,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.searchAnalyticsQuery({
              siteUrl,
              startDate: parsed.data.startDate,
              endDate: parsed.data.endDate,
              dimensions: parsed.data.dimensions,
              type: parsed.data.type,
              ...(parsed.data.aggregationType !== undefined
                ? { aggregationType: parsed.data.aggregationType }
                : {}),
              ...(parsed.data.dataState !== undefined
                ? { dataState: parsed.data.dataState }
                : {}),
              dimensionFilterGroups: buildDimensionFilterGroupsFromInput(
                parsed.data.dimensionFilterGroups,
              ),
              rowLimit: parsed.data.rowLimit,
              startRow: parsed.data.startRow,
              signal: context.signal,
            });
            return mapSearchAnalyticsResponse({
              siteUrl,
              startDate: parsed.data.startDate,
              endDate: parsed.data.endDate,
              dimensions: parsed.data.dimensions,
              rowLimit: parsed.data.rowLimit,
              startRow: parsed.data.startRow,
              ...(parsed.data.dataState !== undefined
                ? { dataState: parsed.data.dataState }
                : {}),
              raw,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GSC_PERFORMANCE_PAGES_TOOL,
        description:
          "Search Analytics preset grouped by page dimension with optional device/country filters.",
        inputSchema: performancePagesInputJsonSchema,
        handler: async (input, context) => {
          const parsed = performancePagesInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let siteUrl: string;
          try {
            siteUrl = resolveConfiguredSiteUrl(
              parsed.data.siteUrl,
              defaultSiteUrl,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const dimensionFilterGroups = buildPresetDimensionFilterGroups({
            ...(parsed.data.device !== undefined
              ? { device: parsed.data.device }
              : {}),
            ...(parsed.data.country !== undefined
              ? { country: parsed.data.country }
              : {}),
          });
          try {
            const raw = await options.client.searchAnalyticsQuery({
              siteUrl,
              startDate: parsed.data.startDate,
              endDate: parsed.data.endDate,
              dimensions: ["page"],
              type: "web",
              dimensionFilterGroups,
              rowLimit: parsed.data.limit,
              startRow: parsed.data.startRow,
              signal: context.signal,
            });
            return mapPerformancePagesResponse({
              siteUrl,
              startDate: parsed.data.startDate,
              endDate: parsed.data.endDate,
              rowLimit: parsed.data.limit,
              startRow: parsed.data.startRow,
              raw,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GSC_PERFORMANCE_QUERIES_TOOL,
        description:
          "Search Analytics preset grouped by query dimension. Query rows may omit anonymized queries; only top rows are returned.",
        inputSchema: performanceQueriesInputJsonSchema,
        handler: async (input, context) => {
          const parsed = performanceQueriesInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let siteUrl: string;
          try {
            siteUrl = resolveConfiguredSiteUrl(
              parsed.data.siteUrl,
              defaultSiteUrl,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          const dimensionFilterGroups = buildPresetDimensionFilterGroups({
            ...(parsed.data.device !== undefined
              ? { device: parsed.data.device }
              : {}),
            ...(parsed.data.country !== undefined
              ? { country: parsed.data.country }
              : {}),
            ...(parsed.data.page !== undefined
              ? { page: parsed.data.page }
              : {}),
          });
          try {
            const raw = await options.client.searchAnalyticsQuery({
              siteUrl,
              startDate: parsed.data.startDate,
              endDate: parsed.data.endDate,
              dimensions: ["query"],
              type: "web",
              dimensionFilterGroups,
              rowLimit: parsed.data.limit,
              startRow: parsed.data.startRow,
              signal: context.signal,
            });
            return mapPerformanceQueriesResponse({
              siteUrl,
              startDate: parsed.data.startDate,
              endDate: parsed.data.endDate,
              rowLimit: parsed.data.limit,
              startRow: parsed.data.startRow,
              raw,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GSC_SITEMAP_LIST_TOOL,
        description:
          "Lists sitemaps submitted for a property via sitemaps.list (read-only).",
        inputSchema: sitemapListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = sitemapListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let siteUrl: string;
          try {
            siteUrl = resolveConfiguredSiteUrl(
              parsed.data.siteUrl,
              defaultSiteUrl,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listSitemaps({
              siteUrl,
              ...(parsed.data.sitemapIndex !== undefined
                ? { sitemapIndex: parsed.data.sitemapIndex }
                : {}),
              signal: context.signal,
            });
            return mapSitemapListResponse(siteUrl, raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GSC_SITEMAP_GET_TOOL,
        description:
          "Returns sitemap status and diagnostics via sitemaps.get. Does not fetch sitemap URLs over arbitrary HTTP.",
        inputSchema: sitemapGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = sitemapGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let siteUrl: string;
          try {
            siteUrl = resolveConfiguredSiteUrl(
              parsed.data.siteUrl,
              defaultSiteUrl,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getSitemap({
              siteUrl,
              sitemapUrl: parsed.data.sitemapUrl,
              signal: context.signal,
            });
            return mapSitemapGetResponse(siteUrl, raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: GSC_URL_INSPECT_TOOL,
        description:
          "Reads URL Inspection results from Google (index:inspect). Does not trigger crawling or indexing. Requires OAuth scope https://www.googleapis.com/auth/webmasters.",
        inputSchema: urlInspectInputJsonSchema,
        handler: async (input, context) => {
          const parsed = urlInspectInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          let siteUrl: string;
          try {
            siteUrl = resolveConfiguredSiteUrl(
              parsed.data.siteUrl,
              defaultSiteUrl,
            );
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.inspectUrl({
              siteUrl,
              inspectionUrl: parsed.data.inspectionUrl,
              ...(parsed.data.languageCode !== undefined
                ? { languageCode: parsed.data.languageCode }
                : {}),
              signal: context.signal,
            });
            return mapUrlInspectionResponse({
              siteUrl,
              inspectionUrl: parsed.data.inspectionUrl,
              raw,
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
