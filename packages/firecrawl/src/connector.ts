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
  FIRECRAWL_CRAWL_START_TOOL,
  FIRECRAWL_CRAWL_STATUS_TOOL,
  FIRECRAWL_MAP_TOOL,
  FIRECRAWL_SCRAPE_TOOL,
  FIRECRAWL_SEARCH_TOOL,
  SEARCH_MAX_LIMIT,
  MAP_MAX_LIMIT,
  CRAWL_MAX_LIMIT,
  CRAWL_MAX_DISCOVERY_DEPTH,
} from "./constants.js";
import type { FirecrawlClient } from "./firecrawl-client.js";
import { mapFirecrawlError } from "./map-firecrawl-error.js";
import {
  mapCrawlStartResponse,
  mapCrawlStatusResponse,
  mapMapResponse,
  mapScrapeResponse,
  mapSearchResponse,
} from "./normalize-firecrawl.js";
import { assertStructuredOutputWithinBudget } from "./output-budget.js";
import type { FirecrawlConfig } from "./schemas.js";
import {
  crawlStartInputJsonSchema,
  crawlStartInputSchema,
  crawlStatusInputJsonSchema,
  crawlStatusInputSchema,
  mapInputJsonSchema,
  mapInputSchema,
  scrapeInputJsonSchema,
  scrapeInputSchema,
  searchInputJsonSchema,
  searchInputSchema,
} from "./tool-schemas.js";

export interface CreateFirecrawlConnectorOptions {
  readonly client: FirecrawlClient;
  readonly config: FirecrawlConfig;
  readonly apiHost?: string;
  readonly apiKeyForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  apiKeyForRedaction?: string,
): ConnectorSdkError {
  return mapFirecrawlError(error, {
    ...(apiKeyForRedaction !== undefined ? { apiKey: apiKeyForRedaction } : {}),
  });
}

export function createFirecrawlConnector(
  options: CreateFirecrawlConnectorOptions,
): DefinedConnector {
  const redactionToken = options.apiKeyForRedaction ?? options.config.apiKey;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Firecrawl MCP connector for OSVA Profile V1: bounded scrape, search, map, and async crawl (start + status with pagination). All tools invoke metered Firecrawl API operations that may consume credits. Scraped text is untrusted. User HTTPS URLs are validated locally; provider-side fetching may follow redirects outside OSVA. No browser automation or webhooks.",
    tools: [
      defineTool({
        name: FIRECRAWL_SCRAPE_TOOL,
        description:
          "Scrapes a single http(s) URL via Firecrawl POST /scrape (markdown output, bounded text).",
        inputSchema: scrapeInputJsonSchema,
        handler: async (input, context) => {
          const parsed = scrapeInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.scrape({
              url: parsed.data.url,
              signal: context.signal,
            });
            const mapped = mapScrapeResponse(raw, parsed.data.url);
            assertStructuredOutputWithinBudget(mapped);
            return mapped;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: FIRECRAWL_SEARCH_TOOL,
        description:
          "Searches the web via Firecrawl POST /search with bounded result count and optional markdown per result.",
        inputSchema: searchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = searchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, SEARCH_MAX_LIMIT);
          try {
            const raw = await options.client.search({
              query: parsed.data.query,
              limit,
              signal: context.signal,
            });
            const mapped = mapSearchResponse(raw);
            assertStructuredOutputWithinBudget(mapped);
            return mapped;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: FIRECRAWL_MAP_TOOL,
        description:
          "Lists discovered site URLs via Firecrawl POST /map with a bounded link limit.",
        inputSchema: mapInputJsonSchema,
        handler: async (input, context) => {
          const parsed = mapInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, MAP_MAX_LIMIT);
          try {
            const raw = await options.client.map({
              url: parsed.data.url,
              limit,
              ...(parsed.data.search !== undefined
                ? { search: parsed.data.search }
                : {}),
              signal: context.signal,
            });
            const mapped = mapMapResponse(raw);
            assertStructuredOutputWithinBudget(mapped);
            return mapped;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: FIRECRAWL_CRAWL_START_TOOL,
        description:
          "Starts a metered async site crawl (POST /crawl). Returns only the crawl job ID (no MCP polling). May consume Firecrawl credits per provider pricing.",
        inputSchema: crawlStartInputJsonSchema,
        handler: async (input, context) => {
          const parsed = crawlStartInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, CRAWL_MAX_LIMIT);
          const maxDiscoveryDepth = Math.min(
            parsed.data.maxDiscoveryDepth,
            CRAWL_MAX_DISCOVERY_DEPTH,
          );
          try {
            const raw = await options.client.startCrawl({
              url: parsed.data.url,
              limit,
              maxDiscoveryDepth,
              signal: context.signal,
            });
            const mapped = mapCrawlStartResponse(raw);
            assertStructuredOutputWithinBudget(mapped);
            return mapped;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: FIRECRAWL_CRAWL_STATUS_TOOL,
        description:
          "Returns Firecrawl crawl job status, credit usage, and a bounded slice of crawled page data. Use the next URL from a prior response (or skip) for pagination.",
        inputSchema: crawlStatusInputJsonSchema,
        handler: async (input, context) => {
          const parsed = crawlStatusInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getCrawlStatus({
              crawlId: parsed.data.crawlId,
              ...(parsed.data.next !== undefined
                ? { next: parsed.data.next }
                : {}),
              ...(parsed.data.skip !== undefined
                ? { skip: parsed.data.skip }
                : {}),
              signal: context.signal,
            });
            const mapped = mapCrawlStatusResponse(raw, {
              ...(options.apiHost !== undefined
                ? { apiHost: options.apiHost }
                : {}),
            });
            assertStructuredOutputWithinBudget(mapped);
            return mapped;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
